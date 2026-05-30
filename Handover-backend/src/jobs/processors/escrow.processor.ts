import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EscrowStatus, HandoverStatus } from '@prisma/client';
import { calcOutgoingPayout } from '../../common/utils/fee.util';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';
import { JobProducerService } from '../producers/job.producer.service';

@Processor(QUEUE.ESCROW)
export class EscrowProcessor extends WorkerHost {
  private readonly logger = new Logger(EscrowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobProducerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB.AUTO_RELEASE_WARNING) {
      await this.handleWarning(job.data.handoverId as string);
    } else if (job.name === JOB.AUTO_RELEASE_FUNDS) {
      await this.handleRelease(job.data.handoverId as string);
    }
  }

  private async handleWarning(handoverId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover || handover.status !== HandoverStatus.active) return;
    await this.notifications.notify(handover.incomingTenantId, 'auto_release_warning', { handoverId });
  }

  private async handleRelease(handoverId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      include: {
        disputes: { where: { status: 'active' } },
        outgoingTenant: { include: { payoutAccount: true } },
      },
    });
    if (!handover || handover.status !== HandoverStatus.active) return;
    if (handover.disputes.length > 0) {
      this.logger.log(`Auto-release skipped — active dispute on handover ${handoverId}`);
      return;
    }

    await this.prisma.handover.update({
      where: { id: handoverId },
      data: {
        status: HandoverStatus.keys_confirmed,
        keysConfirmedAt: new Date(),
        escrowStatus: EscrowStatus.released_outgoing,
      },
    });

    const payout = handover.outgoingTenant.payoutAccount;
    if (payout) {
      const amountKobo = calcOutgoingPayout(handover.retainmentAmount) * 100;
      await this.jobs.schedulePayoutDisbursement(handoverId, payout.accountNumber, amountKobo);
    }

    await this.notifications.notify(handover.outgoingTenantId, 'keys_confirmed', { handoverId });
    await this.notifications.notify(handover.incomingTenantId, 'keys_confirmed', { handoverId });
    this.logger.log(`Auto-release completed for handover ${handoverId}`);
  }
}
