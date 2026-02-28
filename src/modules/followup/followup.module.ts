import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';
import { DiscordModule } from '../discord/discord.module';
import { FollowUpService } from './followup.service';

@Module({
  imports: [DbModule, DiscordModule],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
