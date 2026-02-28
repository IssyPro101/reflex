import { Module } from '@nestjs/common';

import { QueueInfraModule } from '../queue/queue-infra.module';
import { GithubController } from './github.controller';
import { GithubSignatureService } from './github-signature.service';

@Module({
  imports: [QueueInfraModule],
  controllers: [GithubController],
  providers: [GithubSignatureService],
  exports: [GithubSignatureService],
})
export class GithubModule {}
