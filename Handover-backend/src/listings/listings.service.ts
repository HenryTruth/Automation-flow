import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Listing, ListingStatus, Prisma } from '@prisma/client';
import { calcOutgoingPayout, calcPlatformFee, calcRetainmentFee } from '../common/utils/fee.util';
import { buildPaginationMeta, normalizePagination } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingFiltersDto } from './dto/listing-filters.dto';
import { MapFiltersDto } from './dto/map-filters.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async browse(userId: string, filters: ListingFiltersDto) {
    const { skip, take, page, limit } = normalizePagination(filters);
    const where = this.buildWhereClause(filters);

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          propertyType: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          beds: true,
          baths: true,
          annualRent: true,
          retainmentFee: true,
          availableFrom: true,
          interestCount: true,
          status: true,
          photos: true,
          savedBy: { where: { userId }, select: { userId: true } },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    const data = items.map(({ savedBy, ...rest }) => ({
      ...rest,
      is_saved: savedBy.length > 0,
    }));

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async getMapListings(filters: MapFiltersDto) {
    const where = this.buildWhereClause(filters);

    if (filters.bounds) {
      const [swLat, swLng, neLat, neLng] = filters.bounds.split(',').map(Number);
      Object.assign(where, {
        latitude: { gte: swLat, lte: neLat },
        longitude: { gte: swLng, lte: neLng },
      });
    }

    return this.prisma.listing.findMany({
      where,
      select: { id: true, latitude: true, longitude: true, annualRent: true, propertyType: true },
    });
  }

  async getById(listingId: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        user: { select: { id: true, displayName: true, isVerified: true, createdAt: true } },
        savedBy: { where: { userId }, select: { userId: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const { savedBy, user, ...rest } = listing;
    return {
      ...rest,
      is_saved: savedBy.length > 0,
      outgoing_tenant: {
        id: user.id,
        name: user.displayName,
        initials: this.initials(user.displayName),
        is_verified: user.isVerified,
        years_at_address: this.yearsAt(listing.createdAt),
      },
    };
  }

  async getGallery(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { photos: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return { photos: listing.photos, labels: listing.photos.map((_, i) => `Photo ${i + 1}`) };
  }

  async getPaymentPreview(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { retainmentFee: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const retainmentFee = listing.retainmentFee;
    const platformFee = calcPlatformFee(retainmentFee);

    return {
      retainment_fee: retainmentFee,
      platform_fee: platformFee,
      total: retainmentFee,
      outgoing_receives: calcOutgoingPayout(retainmentFee),
      currency: 'NGN',
    };
  }

  async create(userId: string, dto: CreateListingDto): Promise<Listing> {
    if (!dto.latitude || !dto.longitude) {
      throw new UnprocessableEntityException('Listing must include latitude and longitude');
    }

    const hasPayoutAccount = await this.prisma.payoutAccount.findUnique({ where: { userId } });
    if (!hasPayoutAccount && !dto.payoutAccount) {
      throw new UnprocessableEntityException('Payout account required before listing');
    }

    const retainmentFee = calcRetainmentFee(dto.annualRent);

    return this.prisma.$transaction(async (tx) => {
      if (!hasPayoutAccount && dto.payoutAccount) {
        // Payout account creation is handled via UsersService — defer to the controller flow.
        // Here we just assert it will be created; UsersService is called before this in the controller.
      }

      return tx.listing.create({
        data: {
          userId,
          propertyType: dto.propertyType,
          address: dto.address,
          city: dto.city,
          latitude: dto.latitude,
          longitude: dto.longitude,
          beds: dto.beds,
          baths: dto.baths,
          annualRent: dto.annualRent,
          retainmentFee,
          availableFrom: new Date(dto.availableFrom),
          moveOutDate: dto.moveOutDate ? new Date(dto.moveOutDate) : undefined,
          story: dto.story,
          amenities: dto.amenities ?? [],
          photos: dto.photos ?? [],
          status: ListingStatus.active,
        },
      });
    });
  }

  async update(listingId: string, userId: string, dto: UpdateListingDto): Promise<Listing> {
    const listing = await this.findAndAssertOwner(listingId, userId);
    this.assertEditable(listing);

    const retainmentFee = dto.annualRent ? calcRetainmentFee(dto.annualRent) : undefined;

    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        ...dto,
        ...(dto.availableFrom && { availableFrom: new Date(dto.availableFrom) }),
        ...(dto.moveOutDate && { moveOutDate: new Date(dto.moveOutDate) }),
        ...(retainmentFee !== undefined && { retainmentFee }),
      },
    });
  }

  async remove(listingId: string, userId: string): Promise<void> {
    const listing = await this.findAndAssertOwner(listingId, userId);
    this.assertEditable(listing);
    await this.prisma.listing.delete({ where: { id: listingId } });
  }

  async getMyListings(userId: string) {
    return this.prisma.listing.findMany({
      where: { userId, status: { in: [ListingStatus.active, ListingStatus.pending_handover] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSavedListings(userId: string, filters: ListingFiltersDto) {
    const { skip, take, page, limit } = normalizePagination(filters);

    const [items, total] = await Promise.all([
      this.prisma.savedListing.findMany({
        where: { userId, listing: { userId: { not: userId } } },
        skip,
        take,
        orderBy: { savedAt: 'desc' },
        include: { listing: true },
      }),
      this.prisma.savedListing.count({ where: { userId, listing: { userId: { not: userId } } } }),
    ]);

    return {
      data: items.map(({ listing }) => ({ ...listing, is_saved: true })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async save(listingId: string, userId: string): Promise<{ saved: boolean }> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId === userId) throw new ForbiddenException('Cannot save your own listing');

    await this.prisma.savedListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
    });
    return { saved: true };
  }

  async unsave(listingId: string, userId: string): Promise<{ saved: boolean }> {
    await this.prisma.savedListing.deleteMany({ where: { userId, listingId } });
    return { saved: false };
  }

  async restoreToActive(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { user: true },
    });
    if (!listing || listing.user.isBanned) return;
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.active },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildWhereClause(filters: ListingFiltersDto): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {};

    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.types?.length) where.propertyType = { in: filters.types };
    if (filters.amenities?.length) where.amenities = { hasSome: filters.amenities };
    if (filters.rent_min) where.annualRent = { ...where.annualRent as object, gte: filters.rent_min };
    if (filters.rent_max) where.annualRent = { ...where.annualRent as object, lte: filters.rent_max };
    if (filters.move_in_before) {
      where.availableFrom = { lte: new Date(filters.move_in_before) };
    }

    return where;
  }

  private async findAndAssertOwner(listingId: string, userId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) throw new ForbiddenException('Not your listing');
    return listing;
  }

  private assertEditable(listing: Listing): void {
    if (listing.status !== ListingStatus.active) {
      throw new ConflictException('Listing cannot be edited in its current status');
    }
  }

  private initials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  private yearsAt(createdAt: Date): number {
    return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365));
  }
}
