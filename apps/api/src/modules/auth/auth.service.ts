import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { UserConnectionsRepository } from '../db/user-connections.repository';
import {
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
  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly userConnectionsRepository: UserConnectionsRepository,
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
    };
  }> {
    const user = await this.getSupabaseUser(authorizationHeader);
    if (!user) {
      return {
        app: { authenticated: false },
        github: { connected: false },
      };
    }

    const connection = await this.userConnectionsRepository.getBySupabaseUserId(user.id);

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
      };
    }

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
