import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';

@Injectable()
export class GithubSignatureService {
  constructor(@InjectAppConfig() private readonly config: AppConfig) {}

  verify(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!this.config.GITHUB_WEBHOOK_SECRET) {
      return true;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const digest = createHmac('sha256', this.config.GITHUB_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    const expected = Buffer.from(`sha256=${digest}`);
    const provided = Buffer.from(signatureHeader);

    if (expected.length !== provided.length) {
      return false;
    }

    return timingSafeEqual(expected, provided);
  }
}
