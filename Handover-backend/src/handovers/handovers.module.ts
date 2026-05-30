import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { WebhookController, WEBHOOK_HANDOVERS_TOKEN } from '../payments/webhook.controller';
import { HandoversController } from './handovers.controller';
import { HandoversService } from './handovers.service';

@Module({
  imports: [PaymentsModule, NotificationsModule, JobsModule],
  controllers: [HandoversController, WebhookController],
  providers: [
    HandoversService,
    // Expose HandoversService under the token the WebhookController expects
    { provide: WEBHOOK_HANDOVERS_TOKEN, useExisting: HandoversService },
  ],
  exports: [HandoversService],
})
export class HandoversModule {}
