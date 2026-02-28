import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';
import { DiscordModule } from '../discord/discord.module';
import { AckService } from './ack.service';

@Module({
  imports: [DbModule, DiscordModule],
  providers: [AckService],
  exports: [AckService],
})
export class AckModule {}
