import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { ThreadsService } from './threads.service';

@Controller('threads/:id')
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get('messages')
  getMessages(@Param('id') threadId: string, @CurrentUser() user: RequestUser) {
    return this.threadsService.getMessages(threadId, user.id);
  }

  @Post('messages')
  sendMessage(@Param('id') threadId: string, @CurrentUser() user: RequestUser, @Body() dto: SendMessageDto) {
    return this.threadsService.sendMessage(threadId, user.id, dto);
  }
}
