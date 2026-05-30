import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta, normalizePagination } from '../common/utils/pagination.util';

type InboxFilter = 'all' | 'unread' | 'enquiries' | 'handovers';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async getInbox(userId: string, filter: InboxFilter = 'all', page = 1, limit = 20) {
    const { skip, take } = normalizePagination({ page, limit });

    const where: Record<string, unknown> = {
      OR: [{ participantAId: userId }, { participantBId: userId }],
    };

    if (filter === 'unread') {
      where.messages = { some: { senderId: { not: userId }, readByOther: false } };
    } else if (filter === 'enquiries') {
      where.contextType = 'enquiry';
    } else if (filter === 'handovers') {
      where.contextType = 'handover';
    }

    const [threads, total] = await Promise.all([
      this.prisma.thread.findMany({
        where,
        skip,
        take,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participantA: { select: { id: true, displayName: true } },
          participantB: { select: { id: true, displayName: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.thread.count({ where }),
    ]);

    const data = await Promise.all(
      threads.map(async (thread) => {
        const other = thread.participantAId === userId ? thread.participantB : thread.participantA;
        const unreadCount = await this.prisma.message.count({
          where: { threadId: thread.id, senderId: { not: userId }, readByOther: false },
        });
        const lastMessage = thread.messages[0];

        return {
          thread_id: thread.id,
          context_type: thread.contextType,
          context_id: thread.contextId,
          other_participant: {
            id: other.id,
            name: other.displayName,
            initials: other.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
          },
          last_message: lastMessage ? { body: lastMessage.body, time: lastMessage.createdAt } : null,
          unread_count: unreadCount,
        };
      }),
    );

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async markRead(userId: string, threadIds: string[]): Promise<{ updated: number }> {
    // Only process threads where the user is a participant
    const ownedThreads = await this.prisma.thread.findMany({
      where: {
        id: { in: threadIds },
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      select: { id: true },
    });

    const ownedIds = ownedThreads.map((t) => t.id);
    if (!ownedIds.length) return { updated: 0 };

    const result = await this.prisma.message.updateMany({
      where: { threadId: { in: ownedIds }, senderId: { not: userId }, readByOther: false },
      data: { readByOther: true },
    });

    return { updated: result.count };
  }

  async enquire(listingId: string, userId: string): Promise<{ thread_id: string }> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId === userId) throw new ForbiddenException('Cannot enquire about your own listing');

    const [participantAId, participantBId] = [userId, listing.userId].sort();

    const existing = await this.prisma.thread.findFirst({
      where: { participantAId, participantBId, contextType: 'enquiry', contextId: listingId },
    });

    if (existing) return { thread_id: existing.id };

    const thread = await this.prisma.$transaction(async (tx) => {
      const t = await tx.thread.create({
        data: { participantAId, participantBId, contextType: 'enquiry', contextId: listingId },
      });
      await tx.listing.update({
        where: { id: listingId },
        data: { interestCount: { increment: 1 } },
      });
      return t;
    });

    return { thread_id: thread.id };
  }
}
