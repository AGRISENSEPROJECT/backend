import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/community',
})
export class CommunityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CommunityGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace(
          /^Bearer\s+/i,
          '',
        ) as string);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'default-secret',
      });
      const userId = payload?.sub || payload?.id;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      this.broadcastPresence(userId, true);
      this.logger.debug(`WS connected user=${userId} socket=${client.id}`);
    } catch (error) {
      this.logger.warn(`WS auth failed: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    sockets?.delete(client.id);
    if (sockets && sockets.size === 0) {
      this.userSockets.delete(userId);
      this.broadcastPresence(userId, false);
    }
  }

  isUserOnline(userId: string) {
    return (this.userSockets.get(userId)?.size || 0) > 0;
  }

  getOnlineUserIds() {
    return Array.from(this.userSockets.keys());
  }

  private broadcastPresence(userId: string, online: boolean) {
    this.server.emit('presence:update', { userId, online });
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: string): string {
    return data ? `pong:${data}` : 'pong';
  }

  @SubscribeMessage('conversation:join')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (!body?.conversationId) return { ok: false };
    client.join(`conversation:${body.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (!body?.conversationId) return { ok: false };
    client.leave(`conversation:${body.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !body?.conversationId) return { ok: false };
    this.server
      .to(`conversation:${body.conversationId}`)
      .except(client.id)
      .emit('typing:start', {
        conversationId: body.conversationId,
        userId,
      });
    return { ok: true };
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !body?.conversationId) return { ok: false };
    this.server
      .to(`conversation:${body.conversationId}`)
      .except(client.id)
      .emit('typing:stop', {
        conversationId: body.conversationId,
        userId,
      });
    return { ok: true };
  }

  notifyPostCreated(post: any) {
    this.server.emit('post:created', post);
  }

  notifyPostUpdated(post: any) {
    this.server.emit('post:updated', post);
  }

  notifyPostLiked(payload: any) {
    this.server.emit('post:liked', payload);
  }

  notifyPostUnliked(payload: any) {
    this.server.emit('post:unliked', payload);
  }

  notifyPostReaction(payload: any) {
    this.server.emit('post:reaction', payload);
  }

  notifyPostCommented(comment: any) {
    this.server.emit('post:commented', comment);
  }

  notifyCommentUpdated(comment: any) {
    this.server.emit('comment:updated', comment);
  }

  notifyCommentDeleted(payload: { id: string; postId?: string }) {
    this.server.emit('comment:deleted', payload);
  }

  notifyPostDeleted(payload: { id: string }) {
    this.server.emit('post:deleted', payload);
  }

  notifyMessageCreated(message: any, memberUserIds: string[]) {
    const room = `conversation:${message.conversationId}`;
    this.server.to(room).emit('message:new', message);
    for (const userId of memberUserIds) {
      this.server.to(`user:${userId}`).emit('message:new', message);
      this.server.to(`user:${userId}`).emit('conversation:updated', {
        conversationId: message.conversationId,
        lastMessage: message,
      });
    }
  }

  notifyMessageDeleted(payload: any, memberUserIds: string[]) {
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('message:deleted', payload);
    for (const userId of memberUserIds) {
      this.server.to(`user:${userId}`).emit('message:deleted', payload);
    }
  }

  notifyMessagesRead(payload: any, memberUserIds: string[]) {
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('message:read', payload);
    for (const userId of memberUserIds) {
      this.server.to(`user:${userId}`).emit('message:read', payload);
    }
  }

  notifyConversationUpdated(conversation: any, memberUserIds: string[]) {
    for (const userId of memberUserIds) {
      this.server
        .to(`user:${userId}`)
        .emit('conversation:updated', conversation);
    }
  }

  notifyConversationDeleted(
    payload: { id: string },
    memberUserIds: string[],
  ) {
    for (const userId of memberUserIds) {
      this.server.to(`user:${userId}`).emit('conversation:deleted', payload);
    }
  }
}
