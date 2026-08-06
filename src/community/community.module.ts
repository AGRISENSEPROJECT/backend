import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { PostReport } from '../entities/post-report.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { CloudinaryService } from '../auth/cloudinary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Comment, Like, PostReport, ChatMessage]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityGateway, CloudinaryService],
  exports: [CommunityGateway],
})
export class CommunityModule {}
