import { Module } from '@nestjs/common';

import { DbService } from './db.service';
import { MessagesRepository } from './messages.repository';
import { ComplaintsRepository } from './complaints.repository';
import { PrsRepository } from './prs.repository';

@Module({
  providers: [DbService, MessagesRepository, ComplaintsRepository, PrsRepository],
  exports: [DbService, MessagesRepository, ComplaintsRepository, PrsRepository],
})
export class DbModule {}
