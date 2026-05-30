import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertManualDto } from './dto/upsert-manual.dto';
import { ManualService } from './manual.service';

@Controller('listings/:id/manual')
export class ManualController {
  constructor(private readonly manualService: ManualService) {}

  @Get()
  get(@Param('id') listingId: string, @CurrentUser() user: RequestUser) {
    return this.manualService.get(listingId, user.id);
  }

  @Put()
  upsert(@Param('id') listingId: string, @CurrentUser() user: RequestUser, @Body() dto: UpsertManualDto) {
    return this.manualService.upsert(listingId, user.id, dto);
  }
}
