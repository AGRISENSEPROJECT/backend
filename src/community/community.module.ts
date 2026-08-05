import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { PostReport } from '../entities/post-report.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Comment, Like, PostReport]),
    AuthModule,
    AuditModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityGateway],
})
export class CommunityModule {}
