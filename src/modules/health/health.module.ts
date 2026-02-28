import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';
import { DiscordModule } from '../discord/discord.module';
import { QueueInfraModule } from '../queue/queue-infra.module';
import { TelegramModule } from '../telegram/telegram.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [DbModule, QueueInfraModule, DiscordModule, TelegramModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
