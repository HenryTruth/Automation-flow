import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { WsJwtGuard } from './ws-jwt.guard';
import type { RequestUser } from '../common/types/request-user.type';

interface AuthenticatedSocket extends Socket {
  user: RequestUser;
}

@WebSocketGateway({ namespace: '/threads', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = (client.handshake.auth as Record<string, unknown>)?.token as string | undefined;
    if (!token) {
      this.logger.warn('WS connection rejected — no token');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinThread')
  async joinThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() threadId: string,
  ): Promise<void> {
    const userId = client.user?.id;
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });

    if (!thread || (thread.participantAId !== userId && thread.participantBId !== userId)) {
      client.emit('error', 'Not a participant of this thread');
      return;
    }

    await client.join(`thread:${threadId}`);
    this.logger.debug(`User ${userId} joined thread ${threadId}`);
  }

  emitMessage(threadId: string, message: object): void {
    this.server.to(`thread:${threadId}`).emit('message', message);
  }
}
