import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Post, Comment, Like])],
    controllers: [CommunityController],
    providers: [CommunityService, CommunityGateway],
})
export class CommunityModule { }
