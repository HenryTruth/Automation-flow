import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EscrowStatus,
  HandoverStatus,
  HandoverStepName,
  ListingStatus,
  StepStatus,
} from '@prisma/client';
import { calcOutgoingPayout, calcPlatformFee, calcRetainmentFee } from '../common/utils/fee.util';
import { NotificationsService } from '../notifications/notifications.service';
import { JobProducerService } from '../jobs/producers/job.producer.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { formatHandoverResponse } from './formatters/handover-response.formatter';

const HOURS_72 = 72 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;
const HOURS_40 = 40 * 60 * 60 * 1000;

@Injectable()
export class HandoversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobProducerService,
  ) {}

  async create(userId: string, dto: CreateHandoverDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: { user: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId === userId) throw new ForbiddenException('Cannot retain your own listing');
    if (listing.status !== ListingStatus.active) {
      throw new ConflictException('Listing is not available for retainment');
    }

    const retainmentFee = listing.retainmentFee;
    const platformFee = calcPlatformFee(retainmentFee);

    const handover = await this.prisma.$transaction(async (tx) => {
      const h = await tx.handover.create({
        data: {
          listingId: listing.id,
          outgoingTenantId: listing.userId,
          incomingTenantId: userId,
          retainmentAmount: retainmentFee,
          platformFee,
          moveInDate: listing.availableFrom,
          status: HandoverStatus.initiated,
          escrowStatus: EscrowStatus.held,
        },
      });

      await tx.handoverStep.createMany({
        data: [
          { handoverId: h.id, step: HandoverStepName.retainment_paid, status: StepStatus.active },
          { handoverId: h.id, step: HandoverStepName.landlord_confirmed, status: StepStatus.pending },
          { handoverId: h.id, step: HandoverStepName.inspection_done, status: StepStatus.pending },
          { handoverId: h.id, step: HandoverStepName.agreement_signed, status: StepStatus.pending },
          { handoverId: h.id, step: HandoverStepName.keys_received, status: StepStatus.pending },
        ],
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.pending_handover, interestCount: { increment: 1 } },
      });

      // Promote any existing enquiry thread
      await tx.thread.updateMany({
        where: {
          contextType: 'enquiry',
          contextId: listing.id,
          OR: [
            { participantAId: userId, participantBId: listing.userId },
            { participantAId: listing.userId, participantBId: userId },
          ],
        },
        data: { contextType: 'handover', contextId: h.id },
      });

      return h;
    });

    const paymentIntent = await this.payments.initiatePayment(retainmentFee * 100, {
      handover_id: handover.id,
      type: 'retainment',
    });

    return { handover_id: handover.id, payment_intent: paymentIntent };
  }

  async confirmPayment(handoverId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) return;

    const now = new Date();
    const autoReleaseAt = new Date(now.getTime() + HOURS_72);
    const landlordDeadline = new Date(now.getTime() + HOURS_48);

    const [warningJobId, releaseJobId] = await Promise.all([
      this.jobs.scheduleAutoReleaseWarning(handoverId, HOURS_48),
      this.jobs.scheduleAutoReleaseFunds(handoverId, HOURS_72),
    ]);
    const landlordReminderJobId = await this.jobs.scheduleLandlordConfirmReminder(handoverId, HOURS_40);
    await this.jobs.scheduleLandlordConfirmExpiry(handoverId, HOURS_48);

    await this.prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id: handoverId },
        data: {
          status: HandoverStatus.active,
          autoReleaseAt,
          landlordConfirmDeadline: landlordDeadline,
          autoReleaseJobId: releaseJobId,
          autoReleaseWarningJobId: warningJobId,
        },
      });

      await this.advanceStep(tx, handoverId, HandoverStepName.retainment_paid, HandoverStepName.landlord_confirmed);
    });

    await this.notifications.notify(handover.outgoingTenantId, 'retainment_paid', { handoverId });
  }

  async landlordConfirm(handoverId: string, userId: string): Promise<void> {
    const handover = await this.getHandoverOrThrow(handoverId);

    if (handover.outgoingTenantId !== userId) {
      throw new ForbiddenException('Only the outgoing tenant can confirm');
    }
    if (handover.landlordConfirmDeadline && new Date() > handover.landlordConfirmDeadline) {
      throw new ConflictException('Confirmation window has expired');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.advanceStep(tx, handoverId, HandoverStepName.landlord_confirmed, HandoverStepName.inspection_done);
    });

    await this.notifications.notify(handover.incomingTenantId, 'landlord_confirmed', { handoverId });
  }

  async getAll(userId: string) {
    const handovers = await this.prisma.handover.findMany({
      where: { OR: [{ outgoingTenantId: userId }, { incomingTenantId: userId }] },
      include: {
        listing: true,
        steps: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return handovers.map((h) => ({
      ...h,
      role: h.outgoingTenantId === userId ? 'outgoing' : 'incoming',
    }));
  }

  async getById(handoverId: string, userId: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      include: {
        listing: { include: { user: { select: { id: true, displayName: true } } } },
        steps: true,
        checklist: true,
        disputes: true,
        refunds: true,
        incomingTenant: { select: { id: true, displayName: true } },
        outgoingTenant: { select: { id: true, displayName: true } },
      },
    });
    if (!handover) throw new NotFoundException('Handover not found');
    this.assertParticipant(handover, userId);

    return formatHandoverResponse(handover, userId);
  }

  async getSteps(handoverId: string, userId: string) {
    const handover = await this.getHandoverOrThrow(handoverId);
    this.assertParticipant(handover, userId);
    return this.prisma.handoverStep.findMany({ where: { handoverId }, orderBy: { step: 'asc' } });
  }

  async getChecklist(handoverId: string, userId: string) {
    const handover = await this.getHandoverOrThrow(handoverId);
    this.assertParticipant(handover, userId);
    return this.prisma.moveInChecklist.findUnique({ where: { handoverId } });
  }

  async updateChecklist(handoverId: string, userId: string, dto: UpdateChecklistDto) {
    const handover = await this.getHandoverOrThrow(handoverId);
    if (handover.incomingTenantId !== userId) {
      throw new ForbiddenException('Only the incoming tenant can update the checklist');
    }

    const current = await this.prisma.moveInChecklist.findUnique({ where: { handoverId } });
    const wasKeysCollected = current?.keysCollected ?? false;
    const willBeKeysCollected = dto.keysCollected === true;

    const updated = await this.prisma.moveInChecklist.upsert({
      where: { handoverId },
      create: { handoverId, ...dto },
      update: dto,
    });

    if (!wasKeysCollected && willBeKeysCollected) {
      await this.releaseEscrow(handoverId, 'outgoing');
    }

    return updated;
  }

  async confirmKeys(handoverId: string, userId: string) {
    return this.updateChecklist(handoverId, userId, { keysCollected: true });
  }

  async releaseEscrow(handoverId: string, recipient: 'outgoing' | 'incoming'): Promise<void> {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      include: { outgoingTenant: { include: { payoutAccount: true } } },
    });
    if (!handover) return;

    const escrowStatus =
      recipient === 'outgoing' ? EscrowStatus.released_outgoing : EscrowStatus.released_incoming;

    await this.prisma.handover.update({
      where: { id: handoverId },
      data: {
        status: HandoverStatus.keys_confirmed,
        keysConfirmedAt: new Date(),
        escrowStatus,
      },
    });

    if (recipient === 'outgoing') {
      const payout = handover.outgoingTenant.payoutAccount;
      if (payout) {
        const amountKobo = calcOutgoingPayout(handover.retainmentAmount) * 100;
        await this.jobs.schedulePayoutDisbursement(handoverId, payout.accountNumber, amountKobo);
      }
    } else {
      await this.jobs.scheduleRefundDisbursement(handoverId);
    }

    await this.notifications.notify(handover.outgoingTenantId, 'keys_confirmed', { handoverId });
    await this.notifications.notify(handover.incomingTenantId, 'keys_confirmed', { handoverId });
  }

  async getAgreement(handoverId: string, userId: string) {
    const handover = await this.getHandoverOrThrow(handoverId);
    this.assertParticipant(handover, userId);

    const agreement = await this.prisma.tenancyAgreement.findUnique({ where: { handoverId } });
    return agreement ?? { document_url: null, outgoing_signed: false, incoming_signed: false };
  }

  async signAgreement(handoverId: string, userId: string) {
    const handover = await this.getHandoverOrThrow(handoverId);
    this.assertParticipant(handover, userId);

    const isOutgoing = handover.outgoingTenantId === userId;
    const signField = isOutgoing ? 'outgoingSigned' : 'incomingSigned';
    const signedAtField = isOutgoing ? 'outgoingSignedAt' : 'incomingSignedAt';

    const agreement = await this.prisma.tenancyAgreement.upsert({
      where: { handoverId },
      create: { handoverId, [signField]: true, [signedAtField]: new Date() },
      update: { [signField]: true, [signedAtField]: new Date() },
    });

    if (agreement.outgoingSigned && agreement.incomingSigned) {
      await this.prisma.$transaction(async (tx) => {
        await this.advanceStep(tx, handoverId, HandoverStepName.agreement_signed, HandoverStepName.keys_received);
      });
      await this.jobs.scheduleGenerateTenancyPdf(handoverId);
      await this.notifications.notify(handover.outgoingTenantId, 'agreement_signed', { handoverId });
      await this.notifications.notify(handover.incomingTenantId, 'agreement_signed', { handoverId });
    }

    return agreement;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  async getHandoverOrThrow(handoverId: string) {
    const h = await this.prisma.handover.findUnique({ where: { id: handoverId } });
    if (!h) throw new NotFoundException('Handover not found');
    return h;
  }

  private assertParticipant(handover: { outgoingTenantId: string; incomingTenantId: string }, userId: string): void {
    if (handover.outgoingTenantId !== userId && handover.incomingTenantId !== userId) {
      throw new ForbiddenException('Not a participant of this handover');
    }
  }

  private async advanceStep(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    handoverId: string,
    completedStep: HandoverStepName,
    nextStep: HandoverStepName,
  ): Promise<void> {
    await tx.handoverStep.update({
      where: { handoverId_step: { handoverId, step: completedStep } },
      data: { status: StepStatus.done, completedAt: new Date() },
    });
    await tx.handoverStep.update({
      where: { handoverId_step: { handoverId, step: nextStep } },
      data: { status: StepStatus.active },
    });
  }
}
