import { createHmac } from 'crypto';

import { GithubSignatureService } from './github-signature.service';
import { makeAppConfig } from '../../../test/support/app-config';

describe('GithubSignatureService', () => {
  it('accepts valid signature', () => {
    const config = makeAppConfig({ GITHUB_WEBHOOK_SECRET: 'super-secret' });
    const service = new GithubSignatureService(config);

    const body = Buffer.from('{"hello":"world"}');
    const digest = createHmac('sha256', 'super-secret').update(body).digest('hex');

    expect(service.verify(body, `sha256=${digest}`)).toBe(true);
  });

  it('rejects invalid signature', () => {
    const config = makeAppConfig({ GITHUB_WEBHOOK_SECRET: 'super-secret' });
    const service = new GithubSignatureService(config);

    const body = Buffer.from('{"hello":"world"}');
    expect(service.verify(body, 'sha256=invalid')).toBe(false);
  });
});
