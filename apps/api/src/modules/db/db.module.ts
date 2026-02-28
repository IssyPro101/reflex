import { Module } from '@nestjs/common';

import { DbService } from './db.service';
import { MessagesRepository } from './messages.repository';
import { ComplaintsRepository } from './complaints.repository';
import { PrsRepository } from './prs.repository';
import { UserConnectionsRepository } from './user-connections.repository';

@Module({
  providers: [
    DbService,
    MessagesRepository,
    ComplaintsRepository,
    PrsRepository,
    UserConnectionsRepository,
  ],
  exports: [
    DbService,
    MessagesRepository,
    ComplaintsRepository,
    PrsRepository,
    UserConnectionsRepository,
  ],
})
export class DbModule {}
