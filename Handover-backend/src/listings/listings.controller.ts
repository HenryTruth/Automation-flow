import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { VerifiedGuard } from '../common/guards/verified.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingFiltersDto } from './dto/listing-filters.dto';
import { MapFiltersDto } from './dto/map-filters.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@Controller()
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get('listings')
  browse(@CurrentUser() user: RequestUser, @Query() filters: ListingFiltersDto) {
    return this.listingsService.browse(user.id, filters);
  }

  @Get('listings/map')
  getMap(@Query() filters: MapFiltersDto) {
    return this.listingsService.getMapListings(filters);
  }

  @Get('listings/mine')
  getMyListings(@CurrentUser() user: RequestUser) {
    return this.listingsService.getMyListings(user.id);
  }

  @Get('listings/saved')
  getSaved(@CurrentUser() user: RequestUser, @Query() filters: ListingFiltersDto) {
    return this.listingsService.getSavedListings(user.id, filters);
  }

  @Get('listings/:id')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listingsService.getById(id, user.id);
  }

  @Get('listings/:id/gallery')
  getGallery(@Param('id') id: string) {
    return this.listingsService.getGallery(id);
  }

  @Get('listings/:id/payment-preview')
  getPaymentPreview(@Param('id') id: string) {
    return this.listingsService.getPaymentPreview(id);
  }

  @Post('listings')
  @UseGuards(VerifiedGuard)
  createListing(@CurrentUser() user: RequestUser, @Body() dto: CreateListingDto) {
    return this.listingsService.create(user.id, dto);
  }

  @Patch('listings/:id')
  updateListing(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(id, user.id, dto);
  }

  @Delete('listings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeListing(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listingsService.remove(id, user.id);
  }

  @Post('listings/:id/save')
  @HttpCode(HttpStatus.OK)
  saveListing(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listingsService.save(id, user.id);
  }

  @Delete('listings/:id/save')
  @HttpCode(HttpStatus.OK)
  unsaveListing(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listingsService.unsave(id, user.id);
  }
}
