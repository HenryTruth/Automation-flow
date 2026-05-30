import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';

@Processor(QUEUE.PAYOUT)
export class PayoutProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name === JOB.PAYOUT_DISBURSEMENT) {
      const { handoverId, accountNumber, amountKobo } = job.data as {
        handoverId: string;
        accountNumber: string;
        amountKobo: number;
      };
      this.logger.log(`Payout disbursement: ${amountKobo} kobo to ${accountNumber} for handover ${handoverId}`);
      // Payment provider integration goes here when provider is chosen
    }
  }
}
