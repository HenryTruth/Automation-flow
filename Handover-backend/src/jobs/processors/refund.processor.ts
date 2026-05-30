import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';

@Processor(QUEUE.REFUND)
export class RefundProcessor extends WorkerHost {
  private readonly logger = new Logger(RefundProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB.REFUND_AUTO_APPROVE) {
      await this.handleAutoApprove(job.data as { refundId: string; handoverId: string });
    } else if (job.name === JOB.REFUND_DISBURSEMENT) {
      await this.handleDisbursement(job.data.handoverId as string);
    }
  }

  private async handleAutoApprove({ refundId, handoverId }: { refundId: string; handoverId: string }): Promise<void> {
    const activeDispute = await this.prisma.dispute.findFirst({
      where: { handoverId, status: DisputeStatus.active },
    });

    if (activeDispute) {
      this.logger.log(`Refund auto-approve paused — active dispute on handover ${handoverId}`);
      return;
    }

    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund || refund.status !== 'pending') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({ where: { id: refundId }, data: { status: 'approved', processedAt: new Date() } });
      await tx.handover.update({
        where: { id: handoverId },
        data: { status: 'refunded', escrowStatus: 'released_incoming' },
      });
      const handover = await tx.handover.findUnique({ where: { id: handoverId } });
      if (handover) {
        const listing = await tx.listing.findUnique({
          where: { id: handover.listingId },
          include: { user: true },
        });
        if (listing && !listing.user.isBanned) {
          await tx.listing.update({ where: { id: listing.id }, data: { status: 'active' } });
        }
      }
    });

    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (handover) {
      await this.notifications.notify(handover.incomingTenantId, 'refund_approved', { handoverId });
      await this.notifications.notify(handover.outgoingTenantId, 'refund_approved', { handoverId });
    }

    this.logger.log(`Refund ${refundId} auto-approved for handover ${handoverId}`);
  }

  private async handleDisbursement(handoverId: string): Promise<void> {
    this.logger.log(`Refund disbursement initiated for handover ${handoverId}`);
    // Payment provider integration goes here when provider is chosen
  }
}
