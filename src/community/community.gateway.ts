import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/community',
})
export class CommunityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      this.connectedUsers.set(client.id, payload.sub);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.join(`room:${roomId}`);
    return { event: 'joined', roomId };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.leave(`room:${roomId}`);
    return { event: 'left', roomId };
  }

  notifyPostCreated(post: any) {
    this.server.emit('post:created', post);
  }

  notifyPostLiked(data: any) {
    this.server.emit('post:liked', data);
  }

  notifyPostCommented(comment: any) {
    this.server.emit('post:commented', comment);
  }

  notifyPostDeleted(postId: string) {
    this.server.emit('post:deleted', { postId });
  }

  notifyChatMessage(roomId: string, message: any) {
    this.server.to(`room:${roomId}`).emit('chat:message', message);
    this.server.emit('chat:message', message);
  }

  notifyNotification(userId: string, notification: any) {
    this.server.emit(`notification:${userId}`, notification);
  }
}
