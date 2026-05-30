import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

@Controller('handovers/:id/refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  create(@Param('id') handoverId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateRefundDto) {
    return this.refundsService.create(handoverId, user.id, dto);
  }

  @Get('active')
  getActive(@Param('id') handoverId: string, @CurrentUser() user: RequestUser) {
    return this.refundsService.getActive(handoverId, user.id);
  }

  @Delete('active')
  @HttpCode(HttpStatus.OK)
  withdraw(@Param('id') handoverId: string, @CurrentUser() user: RequestUser) {
    return this.refundsService.withdraw(handoverId, user.id);
  }
}
