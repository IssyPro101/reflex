import { Module } from '@nestjs/common';

import { DbService } from './db.service';
import { MessagesRepository } from './messages.repository';
import { ComplaintsRepository } from './complaints.repository';
import { PrsRepository } from './prs.repository';
import { UserConnectionsRepository } from './user-connections.repository';
import { UserTargetsRepository } from './user-targets.repository';

@Module({
  providers: [
    DbService,
    MessagesRepository,
    ComplaintsRepository,
    PrsRepository,
    UserConnectionsRepository,
    UserTargetsRepository,
  ],
  exports: [
    DbService,
    MessagesRepository,
    ComplaintsRepository,
    PrsRepository,
    UserConnectionsRepository,
    UserTargetsRepository,
  ],
})
export class DbModule {}
