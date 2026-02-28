import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';
import { QueueInfraModule } from '../queue/queue-infra.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [DbModule, QueueInfraModule],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
