import { Module } from '@nestjs/common';

import { DbService } from './db.service';
import { MessagesRepository } from './messages.repository';
import { ComplaintsRepository } from './complaints.repository';
import { PrsRepository } from './prs.repository';
import { UserConnectionsRepository } from './user-connections.repository';
import { UserDiscordGuildsRepository } from './user-discord-guilds.repository';
import { UserTargetsRepository } from './user-targets.repository';

@Module({
  providers: [
    DbService,
    MessagesRepository,
    ComplaintsRepository,
    PrsRepository,
    UserConnectionsRepository,
    UserDiscordGuildsRepository,
    UserTargetsRepository,
  ],
  exports: [
    DbService,
    MessagesRepository,
    ComplaintsRepository,
    PrsRepository,
    UserConnectionsRepository,
    UserDiscordGuildsRepository,
    UserTargetsRepository,
  ],
})
export class DbModule {}
