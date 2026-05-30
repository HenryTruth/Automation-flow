import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { HandoverStatus, ListingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';

@Processor(QUEUE.LANDLORD)
export class LandlordProcessor extends WorkerHost {
  private readonly logger = new Logger(LandlordProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB.LANDLORD_CONFIRM_REMINDER) {
      await this.handleReminder(job.data.handoverId as string);
    } else if (job.name === JOB.LANDLORD_CONFIRM_EXPIRED) {
      await this.handleExpiry(job.data.handoverId as string);
    }
  }

  private async handleReminder(handoverId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover || handover.status !== HandoverStatus.active) return;
    await this.notifications.notify(handover.outgoingTenantId, 'landlord_confirm_reminder', { handoverId });
    this.logger.log(`Sent landlord confirmation reminder for handover ${handoverId}`);
  }

  private async handleExpiry(handoverId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      include: { listing: { include: { user: true } } },
    });
    if (!handover) return;

    const step = await this.prisma.handoverStep.findUnique({
      where: { handoverId_step: { handoverId, step: 'landlord_confirmed' } },
    });
    if (step?.status === 'done') return; // Already confirmed

    // Auto-refund and restore listing
    await this.prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id: handoverId },
        data: { status: HandoverStatus.refunded },
      });
      if (!handover.listing.user.isBanned) {
        await tx.listing.update({
          where: { id: handover.listingId },
          data: { status: ListingStatus.active },
        });
      }
    });

    await this.notifications.notify(handover.incomingTenantId, 'landlord_confirm_expired', { handoverId });
    this.logger.log(`Landlord confirmation expired for handover ${handoverId} — auto-refund triggered`);
  }
}
