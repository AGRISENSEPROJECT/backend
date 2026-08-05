import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { PostReport, PostReportStatus } from '../entities/post-report.entity';
import { User, UserRole } from '../entities/user.entity';
import { CommunityGateway } from './community.gateway';
import { AuditService } from '../audit/audit.service';
import {
  ListPostsQueryDto,
  ModerateReportDto,
  ReportPostDto,
} from './dto/create-post.dto';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(PostReport)
    private reportRepository: Repository<PostReport>,
    private communityGateway: CommunityGateway,
    private auditService: AuditService,
  ) {}

  async createPost(
    user: User,
    description: string,
    imageUrl?: string,
    tags?: string[],
  ): Promise<Post> {
    const post = this.postRepository.create({
      user,
      description,
      imageUrl,
      tags: (tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      isHidden: false,
    });
    const savedPost = await this.postRepository.save(post);
    const fullPost = await this.postRepository.findOne({
      where: { id: savedPost.id },
      relations: ['user'],
    });

    if (fullPost) {
      this.communityGateway.notifyPostCreated(fullPost);
      return fullPost;
    }
    return savedPost;
  }

  async getAllPosts(query: ListPostsQueryDto = {}, role?: UserRole) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.comments', 'comments')
      .leftJoinAndSelect('comments.user', 'commentUser')
      .leftJoinAndSelect('post.likes', 'likes')
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (role !== UserRole.ADMIN) {
      qb.andWhere('post.isHidden = false');
    }

    if (query.tag) {
      qb.andWhere(':tag = ANY(post.tags)', {
        tag: query.tag.trim().toLowerCase(),
      });
    }

    if (query.search) {
      qb.andWhere('post.description ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async likePost(user: User, postId: string): Promise<Like | null> {
    const post = await this.getVisiblePost(postId);
    const existingLike = await this.likeRepository.findOne({
      where: {
        user: { id: user.id },
        post: { id: postId },
      },
    });

    if (existingLike) {
      await this.likeRepository.remove(existingLike);
      return null;
    }

    const like = this.likeRepository.create({
      user,
      post,
    });
    const savedLike = await this.likeRepository.save(like);
    this.communityGateway.notifyPostLiked({
      ...savedLike,
      postId: post.id,
      userId: user.id,
    });
    return savedLike;
  }

  async commentOnPost(
    user: User,
    postId: string,
    content: string,
  ): Promise<Comment> {
    const post = await this.getVisiblePost(postId);
    const comment = this.commentRepository.create({
      user,
      post,
      content,
    });
    const savedComment = await this.commentRepository.save(comment);

    const fullComment = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['user'],
    });

    if (fullComment) {
      this.communityGateway.notifyPostCommented({
        ...fullComment,
        postId: post.id,
      });
      return fullComment;
    }
    return savedComment;
  }

  async reportPost(user: User, postId: string, dto: ReportPostDto) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const report = await this.reportRepository.save(
      this.reportRepository.create({
        postId,
        reporterId: user.id,
        reason: dto.reason,
        details: dto.details ?? null,
        status: PostReportStatus.PENDING,
      }),
    );

    return { message: 'Report submitted', report };
  }

  async listReports(status?: PostReportStatus, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const [items, total] = await this.reportRepository.findAndCount({
      where: status ? { status } : {},
      relations: ['post', 'reporter', 'reviewedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * take,
      take,
    });
    return { items, total, page, limit: take };
  }

  async moderateReport(
    admin: User,
    reportId: string,
    dto: ModerateReportDto,
  ) {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['post'],
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = dto.status;
    report.reviewedById = admin.id;
    report.reviewedAt = new Date();
    await this.reportRepository.save(report);

    if (dto.hidePost && report.post) {
      report.post.isHidden = true;
      await this.postRepository.save(report.post);
    }

    await this.auditService.log({
      actorId: admin.id,
      action: 'community.moderate_report',
      resource: 'post_report',
      resourceId: report.id,
      metadata: { status: dto.status, hidePost: !!dto.hidePost },
    });

    return { message: 'Report moderated', report };
  }

  async setPostHidden(admin: User, postId: string, hide: boolean) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    post.isHidden = hide;
    await this.postRepository.save(post);

    await this.auditService.log({
      actorId: admin.id,
      action: hide ? 'community.hide_post' : 'community.unhide_post',
      resource: 'post',
      resourceId: post.id,
    });

    return { message: hide ? 'Post hidden' : 'Post unhidden', post };
  }

  private async getVisiblePost(postId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post || post.isHidden) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }
}
