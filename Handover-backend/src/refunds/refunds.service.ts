import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DisputeStatus, Refund } from '@prisma/client';
import { JobProducerService } from '../jobs/producers/job.producer.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobProducerService,
  ) {}

  async create(handoverId: string, userId: string, dto: CreateRefundDto): Promise<Refund> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) throw new NotFoundException('Handover not found');
    if (handover.incomingTenantId !== userId) throw new ForbiddenException('Only the incoming tenant can request a refund');

    // Eligibility gates
    if (handover.keysConfirmedAt) throw new UnprocessableEntityException('Refund not available after key confirmation');
    if (handover.status === 'completed') throw new UnprocessableEntityException('Handover already completed');

    const existingRefund = await this.prisma.refund.findFirst({
      where: { handoverId, status: 'pending' },
    });
    if (existingRefund) throw new ConflictException('A pending refund already exists');

    // Case 3: Incoming tenant raised a dispute and is now requesting a refund
    const myDispute = await this.prisma.dispute.findFirst({
      where: { handoverId, raisedById: userId, status: DisputeStatus.active },
    });
    if (myDispute) {
      if (!dto.withdrawDispute) {
        throw new ConflictException('You have an active dispute. Pass withdrawDispute: true to withdraw it and proceed with the refund.');
      }
      await this.prisma.dispute.update({
        where: { id: myDispute.id },
        data: { status: DisputeStatus.withdrawn },
      });
    }

    const refund = await this.prisma.refund.create({
      data: {
        handoverId,
        requestedById: userId,
        reason: dto.reason,
        details: dto.details,
        status: 'pending',
        source: 'standard',
        ...(myDispute && { withdrewDisputeId: myDispute.id }),
      },
    });

    await this.jobs.scheduleRefundAutoApprove(refund.id, handoverId);

    return refund;
  }

  async getActive(handoverId: string, userId: string): Promise<Refund> {
    await this.assertParticipant(handoverId, userId);
    const refund = await this.prisma.refund.findFirst({ where: { handoverId, status: 'pending' } });
    if (!refund) throw new NotFoundException('No active refund request');
    return refund;
  }

  async withdraw(handoverId: string, userId: string): Promise<{ success: boolean }> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) throw new NotFoundException('Handover not found');
    if (handover.incomingTenantId !== userId) throw new ForbiddenException('Only the incoming tenant can withdraw');

    const refund = await this.prisma.refund.findFirst({ where: { handoverId, status: 'pending' } });
    if (!refund) throw new NotFoundException('No pending refund found');

    await this.prisma.refund.update({ where: { id: refund.id }, data: { status: 'withdrawn' } });
    return { success: true };
  }

  private async assertParticipant(handoverId: string, userId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) throw new NotFoundException('Handover not found');
    if (handover.outgoingTenantId !== userId && handover.incomingTenantId !== userId) {
      throw new ForbiddenException('Not a participant');
    }
  }
}
