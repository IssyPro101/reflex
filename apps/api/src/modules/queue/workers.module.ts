import { Module } from '@nestjs/common';

import { AckModule } from '../ack/ack.module';
import { DbModule } from '../db/db.module';
import { FollowUpModule } from '../followup/followup.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TriageModule } from '../triage/triage.module';
import { VibeModule } from '../vibe/vibe.module';
import { QueueInfraModule } from './queue-infra.module';
import { JobHandlersService } from './job-handlers.service';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    QueueInfraModule,
    TriageModule,
    AckModule,
    VibeModule,
    TelegramModule,
    FollowUpModule,
    DbModule,
  ],
  providers: [JobHandlersService, WorkerService],
})
export class WorkersModule {}
