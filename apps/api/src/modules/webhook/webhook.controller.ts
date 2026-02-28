import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

import { APP_CONFIG, AppConfig } from '../config/app-config';
import { QueueService } from '../queue/queue.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly queueService: QueueService,
  ) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGithub(
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, any>,
  ): Promise<{ ok: boolean }> {
    this.verifySignature(req.rawBody, signature);

    if (event !== 'pull_request') {
      return { ok: true };
    }

    const action: string | undefined = body.action;
    const merged: boolean = body.pull_request?.merged === true;

    if (action !== 'closed' || !merged) {
      return { ok: true };
    }

    const prNumber: number = body.pull_request.number;
    const repo: string = body.repository?.full_name ?? '';
    const mergedAt: string = body.pull_request.merged_at ?? new Date().toISOString();

    this.logger.log(`PR merged: ${repo}#${prNumber}`);

    await this.queueService.enqueueFollowUp({ prNumber, repo, mergedAt });

    return { ok: true };
  }

  private verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const secret = this.config.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return;
    }

    if (!signature || !rawBody) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
