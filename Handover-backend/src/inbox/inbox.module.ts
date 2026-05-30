import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
  imports: [NotificationsModule],
  controllers: [InboxController, ThreadsController],
  providers: [InboxService, ThreadsService],
  exports: [ThreadsService],
})
export class InboxModule {}
