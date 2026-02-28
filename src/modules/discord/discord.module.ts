import { Module } from '@nestjs/common';

import { IngestionModule } from '../ingestion/ingestion.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [IngestionModule],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
