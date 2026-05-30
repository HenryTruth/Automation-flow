import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MarkReadDto } from './dto/mark-read.dto';
import { InboxService } from './inbox.service';

@Controller()
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('inbox')
  getInbox(
    @CurrentUser() user: RequestUser,
    @Query('filter') filter: 'all' | 'unread' | 'enquiries' | 'handovers' = 'all',
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.inboxService.getInbox(user.id, filter, +page, +limit);
  }

  @Post('inbox/mark-read')
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: RequestUser, @Body() dto: MarkReadDto) {
    return this.inboxService.markRead(user.id, dto.threadIds);
  }

  @Post('listings/:id/enquire')
  @HttpCode(HttpStatus.OK)
  enquire(@Param('id') listingId: string, @CurrentUser() user: RequestUser) {
    return this.inboxService.enquire(listingId, user.id);
  }
}
