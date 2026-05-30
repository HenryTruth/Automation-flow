import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';

@Injectable()
export class JobProducerService {
  constructor(
    @InjectQueue(QUEUE.LANDLORD) private readonly landlordQueue: Queue,
    @InjectQueue(QUEUE.ESCROW) private readonly escrowQueue: Queue,
    @InjectQueue(QUEUE.REFUND) private readonly refundQueue: Queue,
    @InjectQueue(QUEUE.PAYOUT) private readonly payoutQueue: Queue,
    @InjectQueue(QUEUE.PDF) private readonly pdfQueue: Queue,
    @InjectQueue(QUEUE.MEDIATOR) private readonly mediatorQueue: Queue,
  ) {}

  async scheduleLandlordConfirmReminder(handoverId: string, delayMs: number): Promise<string> {
    const job = await this.landlordQueue.add(
      JOB.LANDLORD_CONFIRM_REMINDER,
      { handoverId },
      { delay: delayMs, jobId: `${JOB.LANDLORD_CONFIRM_REMINDER}-${handoverId}` },
    );
    return job.id!;
  }

  async scheduleLandlordConfirmExpiry(handoverId: string, delayMs: number): Promise<string> {
    const job = await this.landlordQueue.add(
      JOB.LANDLORD_CONFIRM_EXPIRED,
      { handoverId },
      { delay: delayMs, jobId: `${JOB.LANDLORD_CONFIRM_EXPIRED}-${handoverId}` },
    );
    return job.id!;
  }

  async scheduleAutoReleaseWarning(handoverId: string, delayMs: number): Promise<string> {
    const job = await this.escrowQueue.add(
      JOB.AUTO_RELEASE_WARNING,
      { handoverId },
      { delay: delayMs, jobId: `${JOB.AUTO_RELEASE_WARNING}-${handoverId}` },
    );
    return job.id!;
  }

  async scheduleAutoReleaseFunds(handoverId: string, delayMs: number): Promise<string> {
    const job = await this.escrowQueue.add(
      JOB.AUTO_RELEASE_FUNDS,
      { handoverId },
      { delay: delayMs, jobId: `${JOB.AUTO_RELEASE_FUNDS}-${handoverId}` },
    );
    return job.id!;
  }

  async cancelJob(queueName: string, jobId: string): Promise<void> {
    const queueMap: Record<string, Queue> = {
      [QUEUE.LANDLORD]: this.landlordQueue,
      [QUEUE.ESCROW]: this.escrowQueue,
      [QUEUE.REFUND]: this.refundQueue,
      [QUEUE.PAYOUT]: this.payoutQueue,
      [QUEUE.PDF]: this.pdfQueue,
      [QUEUE.MEDIATOR]: this.mediatorQueue,
    };
    const queue = queueMap[queueName];
    if (!queue) return;
    const job = await queue.getJob(jobId);
    await job?.remove();
  }

  async scheduleRefundAutoApprove(refundId: string, handoverId: string): Promise<void> {
    const delayMs = 24 * 60 * 60 * 1000;
    await this.refundQueue.add(
      JOB.REFUND_AUTO_APPROVE,
      { refundId, handoverId },
      { delay: delayMs, jobId: `${JOB.REFUND_AUTO_APPROVE}-${handoverId}` },
    );
  }

  async schedulePayoutDisbursement(handoverId: string, accountNumber: string, amountKobo: number): Promise<void> {
    await this.payoutQueue.add(
      JOB.PAYOUT_DISBURSEMENT,
      { handoverId, accountNumber, amountKobo },
      { jobId: `${JOB.PAYOUT_DISBURSEMENT}-${handoverId}` },
    );
  }

  async scheduleRefundDisbursement(handoverId: string): Promise<void> {
    await this.refundQueue.add(
      JOB.REFUND_DISBURSEMENT,
      { handoverId },
      { jobId: `${JOB.REFUND_DISBURSEMENT}-${handoverId}` },
    );
  }

  async scheduleGenerateTenancyPdf(handoverId: string): Promise<void> {
    await this.pdfQueue.add(
      JOB.GENERATE_TENANCY_PDF,
      { handoverId },
      { jobId: `${JOB.GENERATE_TENANCY_PDF}-${handoverId}` },
    );
  }

  async scheduleMediatorAssignment(disputeId: string, handoverId: string): Promise<void> {
    await this.mediatorQueue.add(
      JOB.MEDIATOR_ASSIGNMENT,
      { disputeId, handoverId },
      { jobId: `${JOB.MEDIATOR_ASSIGNMENT}-${disputeId}` },
    );
  }
}
