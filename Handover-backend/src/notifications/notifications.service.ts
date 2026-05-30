import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PushChannel } from './channels/push.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';

// Events that go via WhatsApp (high-value transactional)
const WHATSAPP_EVENTS = new Set([
  'retainment_paid',
  'landlord_confirmed',
  'landlord_confirm_reminder',
  'landlord_confirm_expired',
  'keys_confirmed',
  'payout_initiated',
  'dispute_raised',
  'dispute_resolved',
  'refund_approved',
  'auto_release_warning',
]);

const PREFS_TTL = 60; // cache for 60s

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly push: PushChannel,
    private readonly whatsapp: WhatsappChannel,
  ) {}

  async notify(userId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, deviceToken: true },
    });
    if (!user) return;

    const prefs = await this.getPrefs(userId);
    const { title, body } = this.buildCopy(event, payload);

    const tasks: Promise<void>[] = [];

    if (prefs.push && user.deviceToken) {
      tasks.push(this.push.send(user.deviceToken, title, body));
    }

    if (prefs.whatsapp && WHATSAPP_EVENTS.has(event)) {
      tasks.push(this.whatsapp.send(user.phone, event, { title, body }));
    }

    await Promise.allSettled(tasks);
  }

  private async getPrefs(userId: string) {
    const cacheKey = `notif_prefs:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as { push: boolean; whatsapp: boolean };

    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { push: true, whatsapp: true },
    });

    await this.redis.set(cacheKey, JSON.stringify(prefs), 'EX', PREFS_TTL);
    return prefs;
  }

  private buildCopy(event: string, payload: Record<string, unknown>): { title: string; body: string } {
    const copies: Record<string, { title: string; body: string }> = {
      retainment_paid: { title: 'Retainment Received', body: 'A tenant has paid the retainment for your flat.' },
      landlord_confirmed: { title: 'Landlord Confirmed', body: 'The outgoing tenant has confirmed the handover.' },
      landlord_confirm_reminder: { title: 'Action Required', body: 'Please confirm the handover in the app.' },
      landlord_confirm_expired: { title: 'Handover Cancelled', body: 'The confirmation window has expired. A refund will be processed.' },
      keys_confirmed: { title: 'Keys Confirmed', body: 'Key receipt has been confirmed. Payout is on its way.' },
      dispute_raised: { title: 'Dispute Raised', body: 'A dispute has been raised on your handover. A mediator will contact you.' },
      dispute_resolved: { title: 'Dispute Resolved', body: 'Your dispute has been resolved.' },
      refund_approved: { title: 'Refund Approved', body: 'Your refund has been approved and will be processed shortly.' },
      auto_release_warning: { title: 'Escrow Releasing Soon', body: 'The retainment will be released to the outgoing tenant in 24 hours.' },
      agreement_signed: { title: 'Agreement Signed', body: 'The tenancy agreement has been signed by both parties.' },
      new_message: { title: 'New Message', body: 'You have a new message in Handover.' },
    };

    return copies[event] ?? { title: 'Handover Update', body: 'You have a new update on Handover.' };
  }
}
