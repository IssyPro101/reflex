import { Injectable, Logger } from '@nestjs/common';
import { cp, mkdtemp, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { CommandResult, runCommand } from './command-runner';
import { evaluateChangedFiles } from './file-safety';
import { buildCreatePrPrompt } from './prompt-template';
import { extractPrNumber } from './vibe-output';

interface CreatePrInput {
  complaintId: string;
  summary: string;
  originalMessage: string;
  repoUrl: string;
  baseBranch: string;
  githubToken?: string;
}

export type CreatePrResult =
  | {
      status: 'success';
      prUrl: string;
      prNumber: number;
      branch: string;
      changedFiles: string[];
      warnings: string[];
    }
  | {
      status: 'blocked' | 'failed';
      reason: string;
      prUrl: string | null;
      changedFiles: string[];
      warnings: string[];
    };

@Injectable()
export class VibeService {
  private readonly logger = new Logger(VibeService.name);

  constructor(@InjectAppConfig() private readonly config: AppConfig) {}

  async createPr(input: CreatePrInput): Promise<CreatePrResult> {
    const workspaceRoot = this.resolveWorkspaceRoot();
    await mkdir(workspaceRoot, { recursive: true });

    this.logger.log(
      `Starting createPr for repo ${input.repoUrl} (base=${input.baseBranch}, agent=${this.config.VIBE_AGENT})`,
    );

    const workspace = await mkdtemp(join(workspaceRoot, 'cfca-'));
    const repoDir = join(workspace, 'repo');
    const cloneUrl = this.buildCloneUrl(input.repoUrl, input.githubToken);

    try {
      this.logger.log(`Cloning repo into workspace ${repoDir}`);
      const cloneResult = await runCommand(
        'git',
        ['clone', '--depth=1', cloneUrl, repoDir],
        {
          timeoutMs: 90_000,
          env: this.buildGithubEnv(input.githubToken),
        },
      );
      if (cloneResult.exitCode !== 0) {
        const reason = this.formatCommandFailure('git clone', cloneResult, input.githubToken);
        this.logger.error(reason);
        return {
          status: 'failed',
          reason,
          prUrl: null,
          changedFiles: [],
          warnings: [],
        };
      }

      await this.copyVibeAssets(repoDir);

      const prompt = buildCreatePrPrompt(
        input.complaintId,
        input.summary,
        input.originalMessage,
      );
      const vibeArgs = [
        '--workdir',
        repoDir,
        '--agent',
        this.config.VIBE_AGENT,
        '--prompt',
        prompt,
        '--max-price',
        String(this.config.VIBE_MAX_PRICE),
        '--output',
        'json',
      ];

      this.logger.log(`Running ${this.config.VIBE_BIN} in ${repoDir}`);
      const vibeResult = await runCommand(this.config.VIBE_BIN, vibeArgs, {
        cwd: repoDir,
        timeoutMs: 12 * 60 * 1000,
        env: this.buildGithubEnv(input.githubToken),
        onStdout: (chunk) => this.logger.log(chunk.trimEnd()),
        onStderr: (chunk) => this.logger.warn(chunk.trimEnd()),
      });

      if (vibeResult.exitCode !== 0) {
        const reason = this.formatCommandFailure('vibe', vibeResult, input.githubToken);
        this.logger.error(reason);
        return {
          status: 'failed',
          reason,
          prUrl: null,
          changedFiles: [],
          warnings: [],
        };
      }

      const branch = await this.getCurrentBranch(repoDir);
      const prUrl = await this.findPrUrl(branch, input.repoUrl, input.githubToken);

      if (!prUrl) {
        const reason = `No open PR found for branch ${branch}. Output preview: ${this.getCommandOutputPreview(vibeResult, 2_000, input.githubToken)}`;
        this.logger.error(reason);
        return {
          status: 'failed',
          reason,
          prUrl: null,
          changedFiles: [],
          warnings: [],
        };
      }

      const changedFiles = await this.getChangedFiles(repoDir, input.baseBranch);
      const safety = evaluateChangedFiles(changedFiles);

      if (safety.forbidden.length > 0) {
        this.logger.warn(
          `Blocking PR ${prUrl} due to forbidden file changes: ${safety.forbidden.join(', ')}`,
        );
        await this.closePrBestEffort(prUrl, input.repoUrl, input.githubToken);
        return {
          status: 'blocked',
          reason: `Forbidden files modified: ${safety.forbidden.join(', ')}`,
          prUrl,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      const prNumber = extractPrNumber(prUrl);
      if (!prNumber) {
        return {
          status: 'failed',
          reason: 'Unable to parse PR number from URL',
          prUrl,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      this.logger.log(
        `createPr success: pr=${prUrl} branch=${branch} changedFiles=${changedFiles.length}`,
      );

      return {
        status: 'success',
        prUrl,
        prNumber,
        branch,
        changedFiles,
        warnings: safety.warnings,
      };
    } catch (error) {
      this.logger.error('createPr failed', error as Error);
      return {
        status: 'failed',
        reason: `createPr threw an unexpected error: ${(error as Error).message}`,
        prUrl: null,
        changedFiles: [],
        warnings: [],
      };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private resolveWorkspaceRoot(): string {
    return this.config.WORKSPACE_ROOT || join(tmpdir(), 'cfca-workspaces');
  }

  private async copyVibeAssets(repoDir: string): Promise<void> {
    const localVibeDir = join(process.cwd(), '.vibe');
    const targetVibeDir = join(repoDir, '.vibe');

    try {
      await cp(localVibeDir, targetVibeDir, {
        recursive: true,
        force: true,
      });
    } catch (error) {
      this.logger.warn(`Skipping .vibe asset copy: ${(error as Error).message}`);
    }
  }

  private async getChangedFiles(repoDir: string, baseBranch: string): Promise<string[]> {
    const primary = await runCommand(
      'git',
      ['-C', repoDir, 'diff', '--name-only', `origin/${baseBranch}...HEAD`],
      { timeoutMs: 20_000 },
    );

    if (primary.exitCode !== 0) {
      this.logger.warn(
        `Failed to diff against origin/${baseBranch}; falling back to working-tree diff. ${this.formatCommandFailure('git diff', primary)}`,
      );
    }

    const fallback =
      primary.exitCode === 0
        ? primary
        : await runCommand('git', ['-C', repoDir, 'diff', '--name-only'], {
            timeoutMs: 20_000,
          });

    const output = fallback.stdout || '';
    return output
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private async getCurrentBranch(repoDir: string): Promise<string> {
    const result = await runCommand('git', ['-C', repoDir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeoutMs: 10_000,
    });

    if (result.exitCode !== 0) {
      return 'unknown';
    }

    return result.stdout.trim() || 'unknown';
  }

  private async findPrUrl(
    branch: string,
    repoUrl: string,
    githubToken?: string,
  ): Promise<string | null> {
    const parsed = this.parseOwnerRepo(repoUrl);
    if (!parsed) {
      this.logger.warn(`Cannot parse owner/repo from ${repoUrl}`);
      return null;
    }

    const { owner, repo } = parsed;
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=open`;

    try {
      const response = await fetch(url, {
        headers: this.buildGithubApiHeaders(githubToken),
      });

      if (!response.ok) {
        this.logger.warn(
          `GitHub API returned ${response.status} when looking for PR on branch ${branch}`,
        );
        return null;
      }

      const pulls = (await response.json()) as Array<{ html_url: string }>;
      return pulls.length > 0 ? pulls[0].html_url : null;
    } catch (error) {
      this.logger.warn(`GitHub API request failed for branch ${branch}: ${(error as Error).message}`);
      return null;
    }
  }

  private async closePrBestEffort(
    prUrl: string,
    repoUrl: string,
    githubToken?: string,
  ): Promise<void> {
    const parsed = this.parseOwnerRepo(repoUrl);
    const prNumber = extractPrNumber(prUrl);
    if (!parsed || !prNumber) {
      this.logger.warn(`Cannot close PR: unable to parse repo or PR number from ${prUrl}`);
      return;
    }

    const { owner, repo } = parsed;
    const headers = this.buildGithubApiHeaders(githubToken);

    try {
      const closeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'closed' }),
        },
      );

      if (!closeResponse.ok) {
        this.logger.warn(`Failed to close PR ${prUrl}: GitHub API returned ${closeResponse.status}`);
        return;
      }

      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: 'Auto-closed: forbidden file changes detected by CFCA guardrails.',
          }),
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to close PR ${prUrl}: ${(error as Error).message}`);
    }
  }

  private limit(value: string, max: number): string {
    if (value.length <= max) {
      return value;
    }
    return `${value.slice(0, max)}...`;
  }

  private formatCommandFailure(step: string, result: CommandResult, githubToken?: string): string {
    return `${step} failed (exit ${result.exitCode}). ${this.getCommandOutputPreview(result, 2_000, githubToken)}`;
  }

  private getCommandOutputPreview(
    result: CommandResult,
    max: number = 2_000,
    githubToken?: string,
  ): string {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const output = this.redactSensitive(stderr || stdout, githubToken);

    if (!output) {
      return 'No output captured.';
    }

    return this.limit(output, max);
  }

  private redactSensitive(value: string, githubToken?: string): string {
    if (!value) {
      return value;
    }

    let redacted = value;

    if (githubToken) {
      redacted = redacted.split(githubToken).join('[REDACTED_GITHUB_TOKEN]');
      const encodedToken = encodeURIComponent(githubToken);
      redacted = redacted.split(encodedToken).join('[REDACTED_GITHUB_TOKEN]');
    }

    redacted = redacted.replace(/x-access-token:[^@/\s]+@/gi, 'x-access-token:[REDACTED]@');
    redacted = redacted.replace(/\bgh[a-z]_[a-zA-Z0-9_]+\b/g, '[REDACTED_GITHUB_TOKEN]');

    return redacted;
  }

  private buildCloneUrl(repoUrl: string, githubToken?: string): string {
    if (!githubToken) {
      return repoUrl;
    }

    const normalized = repoUrl.replace(/\.git$/i, '');
    const match = normalized.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/i);
    if (!match) {
      return repoUrl;
    }

    return `https://x-access-token:${encodeURIComponent(githubToken)}@github.com/${match[1]}.git`;
  }

  private parseOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
    const normalized = repoUrl.replace(/\.git$/i, '');
    const match = normalized.match(/github\.com\/([^/]+)\/([^/]+)$/i);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  }

  private buildGithubApiHeaders(githubToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }
    return headers;
  }

  private buildGithubEnv(githubToken?: string): NodeJS.ProcessEnv {
    if (!githubToken) {
      return process.env;
    }

    return {
      ...process.env,
      GH_TOKEN: githubToken,
      GITHUB_TOKEN: githubToken,
    };
  }
}
