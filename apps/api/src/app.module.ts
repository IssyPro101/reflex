import { Module } from '@nestjs/common';

import { ConfigModule } from './modules/config/config.module';
import { DbModule } from './modules/db/db.module';
import { QueueInfraModule } from './modules/queue/queue-infra.module';
import { TriageModule } from './modules/triage/triage.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { DiscordModule } from './modules/discord/discord.module';
import { AckModule } from './modules/ack/ack.module';
import { VibeModule } from './modules/vibe/vibe.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { FollowUpModule } from './modules/followup/followup.module';
import { WorkersModule } from './modules/queue/workers.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    QueueInfraModule,
    TriageModule,
    IngestionModule,
    DiscordModule,
    AckModule,
    VibeModule,
    TelegramModule,
    FollowUpModule,
    WorkersModule,
    HealthModule,
    AuthModule,
    ObservabilityModule,
    WebhookModule,
  ],
})
export class AppModule {}
