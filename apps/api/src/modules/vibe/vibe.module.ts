import { Module } from '@nestjs/common';

import { VibeService } from './vibe.service';

@Module({
  providers: [VibeService],
  exports: [VibeService],
})
export class VibeModule {}
