import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputesService } from './disputes.service';

@Controller()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post('handovers/:id/disputes')
  create(@Param('id') handoverId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(handoverId, user.id, dto);
  }

  @Get('handovers/:id/disputes/active')
  getActive(@Param('id') handoverId: string, @CurrentUser() user: RequestUser) {
    return this.disputesService.getActive(handoverId, user.id);
  }

  @Get('disputes/:id')
  getById(@Param('id') disputeId: string, @CurrentUser() user: RequestUser) {
    return this.disputesService.getById(disputeId, user.id);
  }

  @Post('disputes/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@Param('id') disputeId: string, @CurrentUser() user: RequestUser) {
    return this.disputesService.resolve(disputeId, user.id);
  }

  @Post('disputes/:id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id') disputeId: string, @CurrentUser() user: RequestUser) {
    return this.disputesService.reopen(disputeId, user.id);
  }
}
