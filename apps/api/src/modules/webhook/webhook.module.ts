import { Module } from '@nestjs/common';

import { QueueInfraModule } from '../queue/queue-infra.module';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [QueueInfraModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
