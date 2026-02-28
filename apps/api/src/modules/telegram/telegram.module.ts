import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [DbModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
