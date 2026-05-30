import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { HandoversService } from './handovers.service';

@Controller()
export class HandoversController {
  constructor(private readonly handoversService: HandoversService) {}

  @Post('handovers')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateHandoverDto) {
    return this.handoversService.create(user.id, dto);
  }

  @Get('handovers')
  getAll(@CurrentUser() user: RequestUser) {
    return this.handoversService.getAll(user.id);
  }

  @Get('handovers/:id')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.getById(id, user.id);
  }

  @Get('handovers/:id/steps')
  getSteps(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.getSteps(id, user.id);
  }

  @Post('handovers/:id/landlord-confirm')
  @HttpCode(HttpStatus.OK)
  landlordConfirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.landlordConfirm(id, user.id);
  }

  @Post('handovers/:id/confirm-keys')
  @HttpCode(HttpStatus.OK)
  confirmKeys(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.confirmKeys(id, user.id);
  }

  @Get('handovers/:id/checklist')
  getChecklist(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.getChecklist(id, user.id);
  }

  @Patch('handovers/:id/checklist')
  updateChecklist(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: UpdateChecklistDto) {
    return this.handoversService.updateChecklist(id, user.id, dto);
  }

  @Get('handovers/:id/agreement')
  getAgreement(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.getAgreement(id, user.id);
  }

  @Post('handovers/:id/agreement/sign')
  @HttpCode(HttpStatus.OK)
  signAgreement(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.handoversService.signAgreement(id, user.id);
  }
}
