import { Dispute, Handover, HandoverStep, Listing, MoveInChecklist, Refund, User } from '@prisma/client';

interface HandoverDetail extends Handover {
  listing: Listing & { user: Pick<User, 'id' | 'displayName'> };
  steps: HandoverStep[];
  checklist: MoveInChecklist | null;
  disputes: Dispute[];
  refunds: Refund[];
  incomingTenant: Pick<User, 'id' | 'displayName'>;
  outgoingTenant: Pick<User, 'id' | 'displayName'>;
}

export function formatHandoverResponse(handover: HandoverDetail, requestingUserId: string) {
  const role = handover.outgoingTenantId === requestingUserId ? 'outgoing' : 'incoming';
  const contact = role === 'outgoing' ? handover.incomingTenant : handover.outgoingTenant;

  const activeDispute = handover.disputes.find((d) => d.status === 'active');
  const activeRefund = handover.refunds.find((r) => r.status === 'pending');

  return {
    id: handover.id,
    role,
    listing: {
      title: `${handover.listing.propertyType.replace(/_/g, ' ')} in ${handover.listing.city}`,
      photo: handover.listing.photos?.[0] ?? null,
      city: handover.listing.city,
    },
    status: handover.status,
    move_in_date: handover.moveInDate,
    escrow_amount: handover.retainmentAmount,
    escrow_status: handover.escrowStatus,
    auto_release_at: handover.autoReleaseAt,
    landlord_confirm_deadline: handover.landlordConfirmDeadline,
    keys_confirmed: !!handover.keysConfirmedAt,
    steps: handover.steps.map((s) => ({
      step: s.step,
      status: s.status,
      completed_at: s.completedAt,
    })),
    contact: {
      name: contact.displayName,
      initials: contact.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
      role: role === 'outgoing' ? 'Incoming tenant' : 'Outgoing tenant',
    },
    dispute: activeDispute
      ? {
          active: true,
          dispute_id: activeDispute.id,
          raised_by_me: activeDispute.raisedById === requestingUserId,
        }
      : { active: false },
    refund: handover.keysConfirmedAt
      ? { available: false, reason: 'keys_confirmed' }
      : activeRefund
      ? { available: false, reason: 'refund_pending' }
      : { available: role === 'incoming', reason: null },
  };
}
