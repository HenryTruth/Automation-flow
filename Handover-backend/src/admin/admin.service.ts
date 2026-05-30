import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Appeal } from '@prisma/client';
import { JobProducerService } from '../jobs/producers/job.producer.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { UpdateAppealDto } from './dto/update-appeal.dto';
import { UpholdAppealDto } from './dto/uphold-appeal.dto';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const FIVE_WORKING_DAYS_MS = 5 * 24 * 60 * 60 * 1000; // simplified

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobProducerService,
  ) {}

  async createAppeal(dto: CreateAppealDto): Promise<Appeal> {
    const handover = await this.prisma.handover.findUnique({ where: { id: dto.handoverId } });
    if (!handover) throw new NotFoundException('Handover not found');

    const dispute = await this.prisma.dispute.findFirst({
      where: { handoverId: dto.handoverId, status: 'resolved' },
      orderBy: { resolvedAt: 'desc' },
    });
    if (!dispute?.resolvedAt) throw new UnprocessableEntityException('No resolved dispute found');

    const windowExpired = Date.now() - dispute.resolvedAt.getTime() > FOURTEEN_DAYS_MS;
    if (windowExpired) throw new UnprocessableEntityException('Appeal window (14 days) has expired');

    const appealDeadline = new Date(dispute.resolvedAt.getTime() + FOURTEEN_DAYS_MS);

    const appeal = await this.prisma.appeal.create({
      data: {
        handoverId: dto.handoverId,
        disputeId: dispute.id,
        filedById: dto.filedBy,
        grounds: dto.grounds,
        evidenceDetails: dto.evidenceDetails,
        appealDeadline,
        status: 'open',
      },
    });

    await this.notifications.notify(handover.outgoingTenantId, 'dispute_raised', { handoverId: dto.handoverId });
    await this.notifications.notify(handover.incomingTenantId, 'dispute_raised', { handoverId: dto.handoverId });

    return appeal;
  }

  async updateAppeal(appealId: string, dto: UpdateAppealDto): Promise<Appeal> {
    return this.prisma.appeal.update({ where: { id: appealId }, data: dto as any });
  }

  async upholdAppeal(appealId: string, dto: UpholdAppealDto): Promise<object> {
    const appeal = await this.prisma.appeal.findUnique({ where: { id: appealId } });
    if (!appeal) throw new NotFoundException('Appeal not found');

    const handover = await this.prisma.handover.findUniqueOrThrow({ where: { id: appeal.handoverId } });

    const refund = await this.prisma.$transaction(async (tx) => {
      const r = await tx.refund.create({
        data: {
          handoverId: appeal.handoverId,
          reason: 'appeal_upheld',
          status: 'approved',
          source: 'admin_override',
          processedAt: new Date(),
        },
      });

      await tx.appeal.update({
        where: { id: appealId },
        data: { status: 'upheld', resolvedAt: new Date() },
      });

      if (dto.banOutgoingTenant) {
        await tx.user.update({
          where: { id: handover.outgoingTenantId },
          data: { isBanned: true, bannedAt: new Date(), banReason: `Appeal ${appealId} upheld` },
        });
        // Banned — do NOT restore listing to active
      } else {
        await tx.listing.update({
          where: { id: handover.listingId },
          data: { status: 'active' },
        });
      }

      return r;
    });

    // Refund disbursement scheduled in 5 working days (not immediate)
    await this.jobs.scheduleRefundDisbursement(handover.id);

    await this.notifications.notify(handover.outgoingTenantId, 'dispute_resolved', { handoverId: handover.id });
    await this.notifications.notify(handover.incomingTenantId, 'refund_approved', { handoverId: handover.id });

    return { appeal_id: appealId, refund_id: refund.id, banned: dto.banOutgoingTenant };
  }

  async rejectAppeal(appealId: string): Promise<Appeal> {
    const appeal = await this.prisma.appeal.findUnique({ where: { id: appealId } });
    if (!appeal) throw new NotFoundException('Appeal not found');

    const handover = await this.prisma.handover.findUniqueOrThrow({ where: { id: appeal.handoverId } });

    const updated = await this.prisma.appeal.update({
      where: { id: appealId },
      data: { status: 'rejected', resolvedAt: new Date() },
    });

    await this.notifications.notify(handover.outgoingTenantId, 'dispute_resolved', { handoverId: handover.id });
    await this.notifications.notify(handover.incomingTenantId, 'dispute_resolved', { handoverId: handover.id });

    return updated;
  }
}
