import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Message, Thread } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMessages(threadId: string, userId: string): Promise<Message[]> {
    const thread = await this.getThreadOrThrow(threadId, userId);

    await this.prisma.message.updateMany({
      where: { threadId, senderId: { not: userId }, readByOther: false },
      data: { readByOther: true },
    });

    return this.prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(threadId: string, userId: string, dto: SendMessageDto): Promise<Message> {
    const thread = await this.getThreadOrThrow(threadId, userId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { threadId, senderId: userId, body: dto.body },
      }),
      this.prisma.thread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    const recipientId = thread.participantAId === userId ? thread.participantBId : thread.participantAId;
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (recipient) {
      await this.notifications.notify(recipientId, 'new_message', { threadId });
    }

    return message;
  }

  async getThreadOrThrow(threadId: string, userId: string): Promise<Thread> {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.participantAId !== userId && thread.participantBId !== userId) {
      throw new ForbiddenException('Not a participant of this thread');
    }
    return thread;
  }
}
