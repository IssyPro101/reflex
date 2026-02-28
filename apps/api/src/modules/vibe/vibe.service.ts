import { Injectable, Logger } from '@nestjs/common';
import { cp, mkdtemp, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { CommandResult, runCommand } from './command-runner';
import { evaluateChangedFiles } from './file-safety';
import { buildCreatePrPrompt } from './prompt-template';
import { extractPrNumber, parseVibeOutput } from './vibe-output';

interface CreatePrInput {
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

      const prompt = buildCreatePrPrompt(input.summary, input.originalMessage);
      const vibeArgs = [
        '--workdir',
        repoDir,
        '--agent',
        this.config.VIBE_AGENT,
        '--prompt',
        prompt,
        '--max-turns',
        String(this.config.VIBE_MAX_TURNS),
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

      const parsed = parseVibeOutput(vibeResult.stdout);
      if (!parsed.prUrl) {
        const reason = `Vibe output did not contain a PR URL. Output preview: ${this.getCommandOutputPreview(vibeResult, 2_000, input.githubToken)}`;
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
          `Blocking PR ${parsed.prUrl} due to forbidden file changes: ${safety.forbidden.join(', ')}`,
        );
        await this.closePrBestEffort(parsed.prUrl, input.githubToken);
        return {
          status: 'blocked',
          reason: `Forbidden files modified: ${safety.forbidden.join(', ')}`,
          prUrl: parsed.prUrl,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      const prNumber = extractPrNumber(parsed.prUrl);
      if (!prNumber) {
        return {
          status: 'failed',
          reason: 'Unable to parse PR number from URL',
          prUrl: parsed.prUrl,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      const branch = parsed.branch ?? (await this.getCurrentBranch(repoDir));
      this.logger.log(
        `createPr success: pr=${parsed.prUrl} branch=${branch} changedFiles=${changedFiles.length}`,
      );

      return {
        status: 'success',
        prUrl: parsed.prUrl,
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

  private async closePrBestEffort(
    prUrl: string,
    githubToken?: string,
  ): Promise<void> {
    const closeResult = await runCommand(
      'gh',
      ['pr', 'close', prUrl, '--comment', 'Auto-closed: forbidden file changes detected by CFCA guardrails.'],
      {
        timeoutMs: 20_000,
        env: this.buildGithubEnv(githubToken),
      },
    );

    if (closeResult.exitCode !== 0) {
      this.logger.warn(
        `Failed to auto-close PR ${prUrl}: ${this.getCommandOutputPreview(closeResult, 500, githubToken)}`,
      );
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
