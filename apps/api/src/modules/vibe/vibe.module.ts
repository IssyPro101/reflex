import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { VibeController } from './vibe.controller';
import { VibeService } from './vibe.service';
import { VibeSessionStore } from './vibe-session.store';

@Module({
  imports: [AuthModule],
  controllers: [VibeController],
  providers: [VibeService, VibeSessionStore],
  exports: [VibeService],
})
export class VibeModule {}
