import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HandoverManual } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertManualDto } from './dto/upsert-manual.dto';

@Injectable()
export class ManualService {
  constructor(private readonly prisma: PrismaService) {}

  async get(listingId: string, userId: string): Promise<HandoverManual> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');

    if (listing.userId !== userId) {
      // Non-owner can only read after their handover's keys are confirmed
      const handover = await this.prisma.handover.findFirst({
        where: { listingId, incomingTenantId: userId },
      });
      if (!handover) throw new ForbiddenException('Access denied');
      if (!handover.keysConfirmedAt) throw new ForbiddenException('Manual unlocks after key receipt');
    }

    const manual = await this.prisma.handoverManual.findUnique({ where: { listingId } });
    if (!manual) throw new NotFoundException('Manual not written yet');
    return manual;
  }

  async upsert(listingId: string, userId: string, dto: UpsertManualDto): Promise<HandoverManual> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) throw new ForbiddenException('Only the listing owner can write the manual');

    const existing = await this.prisma.handoverManual.findUnique({ where: { listingId } });

    return this.prisma.handoverManual.upsert({
      where: { listingId },
      create: {
        listingId,
        ...dto,
        publishedAt: new Date(),
      },
      update: {
        ...dto,
        // publishedAt is set only on first save — leave unchanged on updates
        ...(existing ? {} : { publishedAt: new Date() }),
      },
    });
  }
}
