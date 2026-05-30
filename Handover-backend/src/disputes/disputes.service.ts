import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Dispute, DisputeStatus, HandoverStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { JobProducerService } from '../jobs/producers/job.producer.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE } from '../jobs/constants/queue-names';
import { CreateDisputeDto } from './dto/create-dispute.dto';

const HOURS_72 = 72 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobProducerService,
  ) {}

  async create(handoverId: string, userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) throw new NotFoundException('Handover not found');
    if (handover.outgoingTenantId !== userId && handover.incomingTenantId !== userId) {
      throw new ForbiddenException('Not a participant');
    }
    if (['keys_confirmed', 'completed'].includes(handover.status)) {
      throw new ConflictException('Cannot raise dispute in current handover status');
    }

    const activeDispute = await this.prisma.dispute.findFirst({
      where: { handoverId, status: DisputeStatus.active },
    });
    if (activeDispute) throw new ConflictException('An active dispute already exists');

    // Pause auto-release timers
    if (handover.autoReleaseJobId) {
      await this.jobs.cancelJob(QUEUE.ESCROW, handover.autoReleaseJobId);
    }
    if (handover.autoReleaseWarningJobId) {
      await this.jobs.cancelJob(QUEUE.ESCROW, handover.autoReleaseWarningJobId);
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const d = await tx.dispute.create({
        data: { handoverId, raisedById: userId, reason: dto.reason, details: dto.details },
      });
      await tx.handover.update({
        where: { id: handoverId },
        data: { status: HandoverStatus.disputed, autoReleaseJobId: null, autoReleaseWarningJobId: null },
      });
      return d;
    });

    await this.jobs.scheduleMediatorAssignment(dispute.id, handoverId);

    const otherId = handover.outgoingTenantId === userId ? handover.incomingTenantId : handover.outgoingTenantId;
    await this.notifications.notify(otherId, 'dispute_raised', { handoverId });

    return dispute;
  }

  async getActive(handoverId: string, userId: string): Promise<Dispute> {
    await this.assertParticipant(handoverId, userId);
    const dispute = await this.prisma.dispute.findFirst({
      where: { handoverId, status: DisputeStatus.active },
    });
    if (!dispute) throw new NotFoundException('No active dispute');
    return dispute;
  }

  async getById(disputeId: string, userId: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const handover = await this.prisma.handover.findUnique({ where: { id: dispute.handoverId } });
    if (handover?.outgoingTenantId !== userId && handover?.incomingTenantId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return dispute;
  }

  async resolve(disputeId: string, userId: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute || dispute.status !== DisputeStatus.active) throw new NotFoundException('Active dispute not found');

    const handover = await this.prisma.handover.findUniqueOrThrow({ where: { id: dispute.handoverId } });
    const isOutgoing = handover.outgoingTenantId === userId;
    const isIncoming = handover.incomingTenantId === userId;
    if (!isOutgoing && !isIncoming) throw new ForbiddenException('Not a participant');

    const update: Record<string, unknown> = isOutgoing
      ? { outgoingConfirmed: true, outgoingConfirmedAt: new Date() }
      : { incomingConfirmed: true, incomingConfirmedAt: new Date() };

    const updated = await this.prisma.dispute.update({ where: { id: disputeId }, data: update });

    if (updated.outgoingConfirmed && updated.incomingConfirmed) {
      const now = new Date();
      const autoReleaseAt = new Date(now.getTime() + HOURS_72);

      const [warningJobId, releaseJobId] = await Promise.all([
        this.jobs.scheduleAutoReleaseWarning(dispute.handoverId, HOURS_48),
        this.jobs.scheduleAutoReleaseFunds(dispute.handoverId, HOURS_72),
      ]);

      await this.prisma.$transaction(async (tx) => {
        await tx.dispute.update({
          where: { id: disputeId },
          data: { status: DisputeStatus.resolved, resolvedAt: now },
        });
        await tx.handover.update({
          where: { id: dispute.handoverId },
          data: {
            status: HandoverStatus.active,
            autoReleaseAt,
            autoReleaseJobId: releaseJobId,
            autoReleaseWarningJobId: warningJobId,
          },
        });
      });

      await this.notifications.notify(handover.outgoingTenantId, 'dispute_resolved', { handoverId: dispute.handoverId });
      await this.notifications.notify(handover.incomingTenantId, 'dispute_resolved', { handoverId: dispute.handoverId });
    } else {
      const otherId = isOutgoing ? handover.incomingTenantId : handover.outgoingTenantId;
      await this.notifications.notify(otherId, 'dispute_resolved', { handoverId: dispute.handoverId });
    }

    return updated;
  }

  async reopen(disputeId: string, userId: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute || dispute.status !== DisputeStatus.active) throw new NotFoundException('Active dispute not found');

    const handover = await this.prisma.handover.findUniqueOrThrow({ where: { id: dispute.handoverId } });
    const isOutgoing = handover.outgoingTenantId === userId;
    const isIncoming = handover.incomingTenantId === userId;
    if (!isOutgoing && !isIncoming) throw new ForbiddenException('Not a participant');

    // Reset the other party's confirmation
    const resetField = isOutgoing ? { incomingConfirmed: false } : { outgoingConfirmed: false };
    return this.prisma.dispute.update({ where: { id: disputeId }, data: resetField });
  }

  private async assertParticipant(handoverId: string, userId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) throw new NotFoundException('Handover not found');
    if (handover.outgoingTenantId !== userId && handover.incomingTenantId !== userId) {
      throw new ForbiddenException('Not a participant');
    }
  }
}
