import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { QueueService } from '../queue/queue.service';
import { GithubSignatureService } from './github-signature.service';

interface GitHubPullRequestEvent {
  action?: string;
  pull_request?: {
    number?: number;
    merged?: boolean;
    merged_at?: string | null;
  };
  repository?: {
    full_name?: string;
  };
}

@Controller('webhooks/github')
export class GithubController {
  constructor(
    private readonly signatureService: GithubSignatureService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signatureHeader?: string,
    @Headers('x-github-event') githubEvent?: string,
  ): Promise<{ received: boolean; ignored?: boolean }> {
    const bodyBuffer = this.extractBody(req.body);

    if (!this.signatureService.verify(bodyBuffer, signatureHeader)) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }

    if (githubEvent !== 'pull_request') {
      return { received: true, ignored: true };
    }

    const payload = JSON.parse(bodyBuffer.toString('utf8')) as GitHubPullRequestEvent;

    const isMerged = payload.action === 'closed' && payload.pull_request?.merged === true;
    const prNumber = payload.pull_request?.number;
    const repo = payload.repository?.full_name;

    if (isMerged && prNumber && repo) {
      await this.queueService.enqueueFollowUp({
        prNumber,
        repo,
        mergedAt: payload.pull_request?.merged_at ?? new Date().toISOString(),
      });
    }

    return { received: true };
  }

  private extractBody(body: unknown): Buffer {
    if (Buffer.isBuffer(body)) {
      return body;
    }
    if (typeof body === 'string') {
      return Buffer.from(body);
    }
    return Buffer.from(JSON.stringify(body ?? {}));
  }
}
