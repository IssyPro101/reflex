import { Injectable, Logger } from '@nestjs/common';
import { appendFile, cp, mkdtemp, mkdir, readFile, rm } from 'fs/promises';
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
    const branch = this.buildBranchName(input.complaintId);

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

      await this.prepareRepoForWork(repoDir, input.baseBranch, branch, input.githubToken);
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
        env: {
          ...this.buildGithubEnv(input.githubToken),
          VIBE_HOME: join(repoDir, '.vibe'),
        },
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

      const changedFiles = await this.getChangedFiles(repoDir, input.baseBranch);
      if (changedFiles.length === 0) {
        const reason = 'Vibe finished successfully but produced no file changes.';
        this.logger.error(reason);
        return {
          status: 'failed',
          reason,
          prUrl: null,
          changedFiles: [],
          warnings: [],
        };
      }

      const safety = evaluateChangedFiles(changedFiles);
      if (safety.forbidden.length > 0) {
        const reason = `Forbidden files modified: ${safety.forbidden.join(', ')}`;
        this.logger.warn(`Blocking PR creation due to forbidden file changes: ${reason}`);
        return {
          status: 'blocked',
          reason,
          prUrl: null,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      const commitFailure = await this.commitIfNeeded(
        repoDir,
        this.buildCommitMessage(input.summary),
        input.githubToken,
      );
      if (commitFailure) {
        this.logger.error(commitFailure);
        return {
          status: 'failed',
          reason: commitFailure,
          prUrl: null,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      const pushResult = await runCommand(
        'git',
        ['-C', repoDir, 'push', '--set-upstream', 'origin', branch],
        {
          timeoutMs: 90_000,
          env: this.buildGithubEnv(input.githubToken),
        },
      );
      if (pushResult.exitCode !== 0) {
        const reason = this.formatCommandFailure('git push', pushResult, input.githubToken);
        this.logger.error(reason);
        return {
          status: 'failed',
          reason,
          prUrl: null,
          changedFiles,
          warnings: safety.warnings,
        };
      }

      const prUrl = await this.createPrOnGithub({
        branch,
        baseBranch: input.baseBranch,
        repoUrl: input.repoUrl,
        title: this.buildPrTitle(input.summary),
        body: this.buildPrBody(input.complaintId, input.summary, input.originalMessage),
        githubToken: input.githubToken,
      });
      if (!prUrl) {
        const reason = `Failed to create PR for branch ${branch}. Output preview: ${this.getCommandOutputPreview(vibeResult, 2_000, input.githubToken)}`;
        this.logger.error(reason);
        return {
          status: 'failed',
          reason,
          prUrl: null,
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

  private async prepareRepoForWork(
    repoDir: string,
    baseBranch: string,
    branch: string,
    githubToken?: string,
  ): Promise<void> {
    const fetchBase = await runCommand(
      'git',
      ['-C', repoDir, 'fetch', 'origin', baseBranch, '--depth=1'],
      {
        timeoutMs: 90_000,
        env: this.buildGithubEnv(githubToken),
      },
    );
    if (fetchBase.exitCode !== 0) {
      throw new Error(
        this.formatCommandFailure(`git fetch origin ${baseBranch}`, fetchBase, githubToken),
      );
    }

    const checkoutBase = await runCommand(
      'git',
      ['-C', repoDir, 'checkout', '-B', baseBranch, `origin/${baseBranch}`],
      {
        timeoutMs: 20_000,
      },
    );
    if (checkoutBase.exitCode !== 0) {
      throw new Error(
        this.formatCommandFailure(
          `git checkout -B ${baseBranch} origin/${baseBranch}`,
          checkoutBase,
          githubToken,
        ),
      );
    }

    const checkoutBranch = await runCommand('git', ['-C', repoDir, 'checkout', '-b', branch], {
      timeoutMs: 20_000,
    });
    if (checkoutBranch.exitCode !== 0) {
      throw new Error(this.formatCommandFailure(`git checkout -b ${branch}`, checkoutBranch));
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
      const gitignorePath = join(repoDir, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath, 'utf-8').catch(() => '');
      if (!gitignoreContent.includes('.vibe/')) {
        await appendFile(gitignorePath, '\n.vibe/\n');
      }
    } catch (error) {
      this.logger.warn(`Skipping .vibe asset copy: ${(error as Error).message}`);
    }
  }

  private async getChangedFiles(repoDir: string, baseBranch: string): Promise<string[]> {
    const changedFiles = new Set<string>();
    const commands: Array<{ step: string; args: string[] }> = [
      {
        step: `git diff --name-only origin/${baseBranch}...HEAD`,
        args: ['-C', repoDir, 'diff', '--name-only', `origin/${baseBranch}...HEAD`],
      },
      {
        step: 'git diff --name-only',
        args: ['-C', repoDir, 'diff', '--name-only'],
      },
      {
        step: 'git diff --name-only --cached',
        args: ['-C', repoDir, 'diff', '--name-only', '--cached'],
      },
      {
        step: 'git ls-files --others --exclude-standard',
        args: ['-C', repoDir, 'ls-files', '--others', '--exclude-standard'],
      },
    ];

    for (const command of commands) {
      const result = await runCommand('git', command.args, { timeoutMs: 20_000 });
      if (result.exitCode !== 0) {
        this.logger.warn(this.formatCommandFailure(command.step, result));
        continue;
      }

      this.addFilesFromOutput(changedFiles, result.stdout);
    }

    return Array.from(changedFiles);
  }

  private addFilesFromOutput(target: Set<string>, output: string): void {
    for (const entry of output.split('\n')) {
      const normalized = entry.trim().replace(/^\.\//, '');
      if (normalized.length > 0) {
        target.add(normalized);
      }
    }
  }

  private async commitIfNeeded(
    repoDir: string,
    commitMessage: string,
    githubToken?: string,
  ): Promise<string | null> {
    const addResult = await runCommand('git', ['-C', repoDir, 'add', '-A'], {
      timeoutMs: 20_000,
    });
    if (addResult.exitCode !== 0) {
      return this.formatCommandFailure('git add -A', addResult, githubToken);
    }

    const stagedDiffResult = await runCommand('git', ['-C', repoDir, 'diff', '--cached', '--quiet'], {
      timeoutMs: 10_000,
    });

    if (stagedDiffResult.exitCode === 0) {
      this.logger.log('No working tree changes to commit; keeping existing commit history from agent.');
      return null;
    }

    if (stagedDiffResult.exitCode !== 1) {
      return this.formatCommandFailure('git diff --cached --quiet', stagedDiffResult, githubToken);
    }

    const commitResult = await runCommand(
      'git',
      [
        '-C',
        repoDir,
        '-c',
        'user.name=CFCA Bot',
        '-c',
        'user.email=cfca-bot@users.noreply.github.com',
        'commit',
        '-m',
        commitMessage, 
      ],
      {
        timeoutMs: 30_000,
      },
    );
    if (commitResult.exitCode !== 0) {
      return this.formatCommandFailure('git commit', commitResult, githubToken);
    }

    return null;
  }

  private async createPrOnGithub(input: {
    branch: string;
    baseBranch: string;
    repoUrl: string;
    title: string;
    body: string;
    githubToken?: string;
  }): Promise<string | null> {
    const parsed = this.parseOwnerRepo(input.repoUrl);
    if (!parsed) {
      this.logger.warn(`Cannot parse owner/repo from ${input.repoUrl}`);
      return null;
    }

    const { owner, repo } = parsed;

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          ...this.buildGithubApiHeaders(input.githubToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: input.title,
          head: input.branch,
          base: input.baseBranch,
          body: input.body,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            html_url?: string;
            message?: string;
          }
        | null;

      if (!response.ok) {
        const messageSuffix = payload?.message ? `: ${payload.message}` : '';
        this.logger.warn(`GitHub PR creation failed (${response.status})${messageSuffix}`);
        return null;
      }

      if (!payload?.html_url) {
        this.logger.warn('GitHub PR creation response did not include html_url.');
        return null;
      }

      return payload.html_url;
    } catch (error) {
      this.logger.warn(`GitHub PR creation request failed: ${(error as Error).message}`);
      return null;
    }
  }

  private buildBranchName(complaintId: string): string {
    const normalizedId = complaintId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'issue';
    return `fix/cfca-${normalizedId}-${Date.now().toString(36)}`;
  }

  private normalizeSummary(summary: string): string {
    return summary.replace(/\s+/g, ' ').trim();
  }

  private buildPrTitle(summary: string): string {
    const normalized = this.normalizeSummary(summary);
    if (!normalized) {
      return 'CFCA automated bug fix';
    }

    return this.limit(normalized, 120);
  }

  private buildCommitMessage(summary: string): string {
    const normalized = this.normalizeSummary(summary);
    if (!normalized) {
      return 'fix: automated bug fix';
    }

    return `fix: ${this.limit(normalized, 60)}`;
  }

  private buildPrBody(complaintId: string, summary: string, originalMessage: string): string {
    const normalizedSummary = this.normalizeSummary(summary) || 'Automated bug fix';
    const normalizedReport =
      this.limit(originalMessage.trim(), 2_000) || 'No original user report provided.';
    const quotedReport = normalizedReport
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');

    return [
      'Automated fix generated by CFCA vibe workflow.',
      '',
      `Summary: ${normalizedSummary}`,
      '',
      'Original user report:',
      quotedReport,
      '',
      `CFCA_COMPLAINT_ID:${complaintId}`,
    ].join('\n');
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
    const match = normalized.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
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
