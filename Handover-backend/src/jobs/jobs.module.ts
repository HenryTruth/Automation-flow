import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUE } from './constants/queue-names';
import { EscrowProcessor } from './processors/escrow.processor';
import { LandlordProcessor } from './processors/landlord.processor';
import { MediatorProcessor } from './processors/mediator.processor';
import { PayoutProcessor } from './processors/payout.processor';
import { PdfProcessor } from './processors/pdf.processor';
import { RefundProcessor } from './processors/refund.processor';
import { JobProducerService } from './producers/job.producer.service';

const queues = Object.values(QUEUE).map((name) => BullModule.registerQueue({ name }));

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('redis.url') },
      }),
    }),
    ...queues,
    StorageModule,
    NotificationsModule,
  ],
  providers: [
    JobProducerService,
    LandlordProcessor,
    EscrowProcessor,
    RefundProcessor,
    PayoutProcessor,
    PdfProcessor,
    MediatorProcessor,
  ],
  exports: [JobProducerService],
})
export class JobsModule {}
