import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { UserConnectionsRepository } from '../db/user-connections.repository';
import { UserDiscordGuildsRepository } from '../db/user-discord-guilds.repository';
import { UserTargetsRepository } from '../db/user-targets.repository';
import {
  GithubTargetInput,
  GithubTargetResponse,
  GithubRepoResponse,
  GithubTokenResponse,
  GithubUserResponse,
  SupabaseUserResponse,
} from './auth.types';

interface GithubStatePayload {
  sub: string;
  ts: number;
  nonce: string;
  next?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly userConnectionsRepository: UserConnectionsRepository,
    private readonly userDiscordGuildsRepository: UserDiscordGuildsRepository,
    private readonly userTargetsRepository: UserTargetsRepository,
  ) {}

  async getGithubConnectUrl(
    authorizationHeader: string | undefined,
    next?: string,
  ): Promise<string> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const state = this.createSignedState(user.id, next);
    return this.buildGithubAuthorizeUrl(state);
  }

  async completeGithubOAuth(
    code: string,
    state: string,
  ): Promise<{ login: string; next?: string }> {
    const verifiedState = this.verifySignedState(state);

    if (!this.config.GITHUB_OAUTH_CLIENT_ID || !this.config.GITHUB_OAUTH_CLIENT_SECRET) {
      throw new Error('GitHub OAuth credentials are not configured');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.GITHUB_OAUTH_CLIENT_ID,
        client_secret: this.config.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenResponse.status}`);
    }

    const tokenJson = (await tokenResponse.json()) as GithubTokenResponse & {
      error?: string;
      error_description?: string;
    };

    if (!tokenJson.access_token) {
      throw new Error(tokenJson.error_description ?? tokenJson.error ?? 'No access token received');
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenJson.access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`GitHub user fetch failed: ${userResponse.status}`);
    }

    const githubUser = (await userResponse.json()) as GithubUserResponse;

    await this.userConnectionsRepository.upsertBySupabaseUserId({
      supabaseUserId: verifiedState.sub,
      githubUserId: githubUser.id,
      githubLogin: githubUser.login,
      githubName: githubUser.name,
      githubAccessToken: tokenJson.access_token,
      githubScope: tokenJson.scope ?? null,
    });

    return {
      login: githubUser.login,
      next: verifiedState.next,
    };
  }

  async getMe(authorizationHeader: string | undefined): Promise<{
    app: {
      authenticated: boolean;
      userId?: string;
      email?: string | null;
    };
    github: {
      connected: boolean;
      login?: string;
      name?: string | null;
      scope?: string | null;
      target?: GithubTargetResponse | null;
    };
    discord: {
      guildIds: string[];
    };
    telegram: {
      chatId?: string | null;
    };
  }> {
    const user = await this.getSupabaseUser(authorizationHeader);
    if (!user) {
      return {
        app: { authenticated: false },
        github: { connected: false },
        discord: { guildIds: [] },
        telegram: {},
      };
    }

    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);
    const guilds = await this.userDiscordGuildsRepository.listBySupabaseUserId(user.id);
    const guildIds = guilds.map((item) => item.guild_id);

    if (!connection) {
      return {
        app: {
          authenticated: true,
          userId: user.id,
          email: user.email ?? null,
        },
        github: {
          connected: false,
        },
        discord: { guildIds },
        telegram: {},
      };
    }

    const target = await this.userTargetsRepository.getBySupabaseUserId(user.id);

    return {
      app: {
        authenticated: true,
        userId: user.id,
        email: user.email ?? null,
      },
      github: {
        connected: true,
        login: connection.github_login,
        name: connection.github_name,
        scope: connection.github_scope,
        target: target
          ? {
              repoUrl: target.repo_url,
              baseBranch: target.base_branch,
            }
          : null,
      },
      discord: {
        guildIds,
      },
      telegram: {
        chatId: connection.telegram_chat_id,
      },
    };
  }

  async listRepos(authorizationHeader: string | undefined): Promise<GithubRepoResponse[]> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);

    if (!connection) {
      throw new UnauthorizedException('GitHub is not connected');
    }

    const reposResponse = await fetch(
      'https://api.github.com/user/repos?affiliation=owner,collaborator&sort=updated&per_page=100',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${connection.github_access_token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!reposResponse.ok) {
      throw new Error(`GitHub repos fetch failed: ${reposResponse.status}`);
    }

    const repos = (await reposResponse.json()) as GithubRepoResponse[];
    return repos.filter(
      (repo) => repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain,
    );
  }

  async disconnectGithub(authorizationHeader: string | undefined): Promise<void> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    await this.userConnectionsRepository.deleteBySupabaseUserId(user.id);
  }

  async getGithubTarget(
    authorizationHeader: string | undefined,
  ): Promise<GithubTargetResponse | null> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);

    if (!connection) {
      throw new UnauthorizedException('GitHub is not connected');
    }

    const target = await this.userTargetsRepository.getBySupabaseUserId(user.id);
    if (!target) {
      return null;
    }

    return {
      repoUrl: target.repo_url,
      baseBranch: target.base_branch,
    };
  }

  async setGithubTarget(
    authorizationHeader: string | undefined,
    input: GithubTargetInput,
  ): Promise<GithubTargetResponse> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);

    if (!connection) {
      throw new UnauthorizedException('GitHub is not connected');
    }

    const ownerRepo = this.extractOwnerRepo(input.repoUrl);
    const repoUrl = `https://github.com/${ownerRepo}.git`;
    const baseBranch = this.normalizeBranch(input.baseBranch);

    await this.assertRepoWriteAccess(connection.github_access_token, ownerRepo);
    await this.assertBranchExists(connection.github_access_token, ownerRepo, baseBranch);
    const target = await this.userTargetsRepository.upsertBySupabaseUserId({
      supabaseUserId: user.id,
      repoUrl,
      baseBranch,
    });

    await this.ensureWebhookInstalled(connection.github_access_token, ownerRepo);

    return {
      repoUrl: target.repo_url,
      baseBranch: target.base_branch,
    };
  }

  async listDiscordGuildLinks(authorizationHeader: string | undefined): Promise<string[]> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const links = await this.userDiscordGuildsRepository.listBySupabaseUserId(user.id);
    return links.map((item) => item.guild_id);
  }

  async linkDiscordGuild(
    authorizationHeader: string | undefined,
    guildId: string,
  ): Promise<void> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const normalized = guildId.trim();
    if (!normalized) {
      throw new BadRequestException('guildId is required');
    }

    await this.userDiscordGuildsRepository.linkGuildToSupabaseUserId(user.id, normalized);
  }

  async unlinkDiscordGuild(
    authorizationHeader: string | undefined,
    guildId: string,
  ): Promise<void> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const normalized = guildId.trim();
    if (!normalized) {
      throw new BadRequestException('guildId is required');
    }

    await this.userDiscordGuildsRepository.unlinkGuildFromSupabaseUserId(user.id, normalized);
  }

  async linkTelegram(
    authorizationHeader: string | undefined,
    telegramChatId: string,
  ): Promise<void> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);
    if (!connection) {
      throw new UnauthorizedException('GitHub is not connected');
    }

    const normalized = telegramChatId.trim();
    if (!normalized) {
      throw new BadRequestException('telegramChatId is required');
    }

    await this.userConnectionsRepository.setTelegramChatId(user.id, normalized);
  }

  async unlinkTelegram(authorizationHeader: string | undefined): Promise<void> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    await this.userConnectionsRepository.clearTelegramChatId(user.id);
  }

  async getGithubContextFromAuthHeader(
    authorizationHeader: string | undefined,
  ): Promise<{ login: string; accessToken: string }> {
    const user = await this.requireSupabaseUser(authorizationHeader);
    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);

    if (!connection) {
      throw new UnauthorizedException('GitHub is not connected');
    }

    return {
      login: connection.github_login,
      accessToken: connection.github_access_token,
    };
  }

  async requireSupabaseUser(
    authorizationHeader: string | undefined,
  ): Promise<SupabaseUserResponse> {
    const user = await this.getSupabaseUser(authorizationHeader);
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return user;
  }

  getFrontendUrl(defaultPath: string = '/'): string {
    try {
      return new URL(defaultPath, this.config.FRONTEND_URL).toString();
    } catch {
      return this.config.FRONTEND_URL;
    }
  }

  private buildGithubAuthorizeUrl(state: string): string {
    if (!this.config.GITHUB_OAUTH_CLIENT_ID) {
      throw new Error('GITHUB_OAUTH_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.config.GITHUB_OAUTH_CLIENT_ID,
      scope: this.config.GITHUB_OAUTH_SCOPE,
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  private createSignedState(supabaseUserId: string, next?: string): string {
    const payload: GithubStatePayload = {
      sub: supabaseUserId,
      ts: Date.now(),
      nonce: randomBytes(12).toString('hex'),
      next: this.sanitizeNext(next),
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.config.APP_AUTH_SECRET)
      .update(encodedPayload)
      .digest('hex');

    return `${encodedPayload}.${signature}`;
  }

  private verifySignedState(state: string): GithubStatePayload {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw new Error('Invalid OAuth state');
    }

    const expectedSignature = createHmac('sha256', this.config.APP_AUTH_SECRET)
      .update(encodedPayload)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new Error('OAuth state signature mismatch');
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as GithubStatePayload;

    const ageMs = Date.now() - payload.ts;
    if (ageMs > this.config.GITHUB_OAUTH_STATE_TTL_SECONDS * 1000) {
      throw new Error('OAuth state expired');
    }

    return payload;
  }

  private sanitizeNext(next: string | undefined): string | undefined {
    if (!next) {
      return undefined;
    }

    if (!next.startsWith('/')) {
      return undefined;
    }

    return next;
  }

  private extractOwnerRepo(repoValue: string): string {
    const trimmed = repoValue.trim().replace(/\.git$/i, '');
    const ownerRepoRegex = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

    if (ownerRepoRegex.test(trimmed)) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase() !== 'github.com') {
        throw new BadRequestException('Only github.com repositories are supported');
      }

      const path = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!ownerRepoRegex.test(path)) {
        throw new BadRequestException('Invalid GitHub repository format');
      }

      return path;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid repo URL. Expected owner/repo or a github.com URL');
    }
  }

  private normalizeBranch(branchValue: string): string {
    const branch = branchValue.trim();
    if (!branch) {
      throw new BadRequestException('baseBranch is required');
    }

    if (
      branch.length > 255 ||
      branch.startsWith('/') ||
      branch.endsWith('/') ||
      branch.startsWith('-') ||
      branch.endsWith('.') ||
      branch.includes('..') ||
      /[\s~^:?*\[\]\\]/.test(branch)
    ) {
      throw new BadRequestException('Invalid base branch name');
    }

    return branch;
  }

  private async assertRepoWriteAccess(accessToken: string, ownerRepo: string): Promise<void> {
    const response = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (response.status === 404) {
      throw new BadRequestException(`Repository not found or inaccessible: ${ownerRepo}`);
    }

    if (!response.ok) {
      throw new Error(`GitHub repo validation failed: ${response.status}`);
    }

    const repo = (await response.json()) as GithubRepoResponse;
    const writable = repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain;

    if (!writable) {
      throw new UnauthorizedException(
        `GitHub token does not have write access to repository: ${ownerRepo}`,
      );
    }
  }

  private async assertBranchExists(
    accessToken: string,
    ownerRepo: string,
    branch: string,
  ): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${ownerRepo}/branches/${encodeURIComponent(branch)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 404) {
      throw new BadRequestException(`Base branch "${branch}" not found in repository ${ownerRepo}`);
    }

    if (!response.ok) {
      throw new Error(`GitHub branch validation failed: ${response.status}`);
    }
  }

  private async ensureWebhookInstalled(accessToken: string, ownerRepo: string): Promise<void> {
    const webhookUrl = `${this.config.API_BASE_URL}/webhooks/github`;

    try {
      const existingHooks = await this.listRepoWebhooks(accessToken, ownerRepo);
      const alreadyInstalled = existingHooks.some(
        (hook: { config?: { url?: string }; active?: boolean }) =>
          hook.config?.url === webhookUrl && hook.active,
      );

      if (alreadyInstalled) {
        this.logger.log(`Webhook already installed on ${ownerRepo}`);
        return;
      }

      await this.createRepoWebhook(accessToken, ownerRepo, webhookUrl);
      this.logger.log(`Webhook installed on ${ownerRepo}`);
    } catch (error) {
      this.logger.warn(
        `Failed to install webhook on ${ownerRepo}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async listRepoWebhooks(
    accessToken: string,
    ownerRepo: string,
  ): Promise<Array<{ config?: { url?: string }; active?: boolean }>> {
    const response = await fetch(`https://api.github.com/repos/${ownerRepo}/hooks`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub list hooks failed: ${response.status}`);
    }

    return (await response.json()) as Array<{ config?: { url?: string }; active?: boolean }>;
  }

  private async createRepoWebhook(
    accessToken: string,
    ownerRepo: string,
    webhookUrl: string,
  ): Promise<void> {
    const body: Record<string, unknown> = {
      name: 'web',
      active: true,
      events: ['pull_request'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        insecure_ssl: '0',
        ...(this.config.GITHUB_WEBHOOK_SECRET
          ? { secret: this.config.GITHUB_WEBHOOK_SECRET }
          : {}),
      },
    };

    const response = await fetch(`https://api.github.com/repos/${ownerRepo}/hooks`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitHub create hook failed: ${response.status} ${errorBody}`);
    }
  }

  private async getSupabaseUser(
    authorizationHeader: string | undefined,
  ): Promise<SupabaseUserResponse | null> {
    const token = this.extractBearerToken(authorizationHeader);
    if (!token) {
      return null;
    }

    if (!this.config.SUPABASE_URL || !this.config.SUPABASE_ANON_KEY) {
      throw new Error('Supabase auth configuration is missing');
    }

    const response = await fetch(`${this.config.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: this.config.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Supabase user lookup failed: ${response.status}`);
    }

    return (await response.json()) as SupabaseUserResponse;
  }

  private extractBearerToken(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
      return null;
    }

    return token;
  }
}
