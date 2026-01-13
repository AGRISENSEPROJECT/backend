import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class CommunityGateway {
    @WebSocketServer()
    server: Server;

    @SubscribeMessage('ping')
    handlePing(@MessageBody() data: string): string {
        return 'pong';
    }

    notifyPostCreated(post: any) {
        this.server.emit('post:created', post);
    }

    notifyPostLiked(like: any) {
        this.server.emit('post:liked', like);
    }

    notifyPostCommented(comment: any) {
        this.server.emit('post:commented', comment);
    }
}
