import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { PostReport, ReportStatus } from '../entities/post-report.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { mapToAuthor } from '../common/utils/author.mapper';
import { CommunityGateway } from './community.gateway';
import { ReportPostDto } from './dto/create-post.dto';

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
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private communityGateway: CommunityGateway,
  ) {}

  private formatPost(post: Post) {
    return {
      id: post.id,
      description: post.description,
      imageUrl: post.imageUrl,
      isHidden: post.isHidden,
      author: post.user ? mapToAuthor(post.user) : null,
      likesCount: post.likes?.length || 0,
      commentsCount: post.comments?.length || 0,
      comments: post.comments?.map((c) => ({
        id: c.id,
        content: c.content,
        author: c.user ? mapToAuthor(c.user) : null,
        createdAt: c.createdAt,
      })),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  async createPost(user: User, description?: string, imageUrl?: string) {
    const post = this.postRepository.create({
      user,
      description,
      imageUrl,
    });
    const savedPost = await this.postRepository.save(post);
    const fullPost = await this.postRepository.findOne({
      where: { id: savedPost.id },
      relations: ['user', 'comments', 'likes', 'comments.user'],
    });

    if (fullPost) {
      const formatted = this.formatPost(fullPost);
      this.communityGateway.notifyPostCreated(formatted);
      return formatted;
    }
    return savedPost;
  }

  async getAllPosts(page = 1, limit = 20) {
    const [posts, total] = await this.postRepository.findAndCount({
      where: { isHidden: false },
      relations: ['user', 'comments', 'likes', 'comments.user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      posts: posts.map((p) => this.formatPost(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPostById(postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isHidden: false },
      relations: ['user', 'comments', 'likes', 'comments.user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.formatPost(post);
  }

  async editPost(user: User, postId: string, description?: string, imageUrl?: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id !== user.id) {
      throw new ForbiddenException('You can only edit your own posts');
    }
    if (description !== undefined) post.description = description;
    if (imageUrl !== undefined) post.imageUrl = imageUrl;
    await this.postRepository.save(post);
    const fullPost = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user', 'comments', 'likes', 'comments.user'],
    });
    return this.formatPost(fullPost!);
  }

  async deletePost(user: User, postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');

    const isOwner = post.user?.id === user.id;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postRepository.remove(post);
    this.communityGateway.notifyPostDeleted(postId);
    return { message: 'Post deleted successfully' };
  }

  async likePost(user: User, postId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existingLike = await this.likeRepository.findOne({
      where: { user: { id: user.id }, post: { id: postId } },
    });

    if (existingLike) {
      await this.likeRepository.remove(existingLike);
      this.communityGateway.notifyPostLiked({ postId, userId: user.id, liked: false });
      return { liked: false, message: 'Post unliked' };
    }

    const like = this.likeRepository.create({ user, post });
    await this.likeRepository.save(like);
    this.communityGateway.notifyPostLiked({ postId, userId: user.id, liked: true });
    return { liked: true, message: 'Post liked' };
  }

  async commentOnPost(user: User, postId: string, content: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const comment = this.commentRepository.create({ user, post, content });
    const savedComment = await this.commentRepository.save(comment);
    const fullComment = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['user'],
    });

    if (fullComment) {
      const formatted = {
        id: fullComment.id,
        content: fullComment.content,
        author: mapToAuthor(fullComment.user),
        postId,
        createdAt: fullComment.createdAt,
      };
      this.communityGateway.notifyPostCommented(formatted);
      return formatted;
    }
    return savedComment;
  }

  async reportPost(user: User, postId: string, dto: ReportPostDto) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.reportRepository.findOne({
      where: { postId, reporterId: user.id },
    });
    if (existing) throw new BadRequestException('You have already reported this post');

    const report = this.reportRepository.create({
      post,
      postId,
      reporter: user,
      reporterId: user.id,
      reason: dto.reason,
      description: dto.description,
      status: ReportStatus.PENDING,
    });
    await this.reportRepository.save(report);

    post.isReported = true;
    await this.postRepository.save(post);

    return { message: 'Post reported successfully', reportId: report.id };
  }

  async getReports(page = 1, limit = 20) {
    const [reports, total] = await this.reportRepository.findAndCount({
      relations: ['post', 'reporter', 'post.user'],
      where: { status: ReportStatus.PENDING },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { reports, total, page, limit };
  }

  async moderatePost(postId: string, action: 'hide' | 'dismiss') {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    if (action === 'hide') {
      post.isHidden = true;
      await this.postRepository.save(post);
      this.communityGateway.notifyPostDeleted(postId);
    }

    await this.reportRepository.update({ postId }, { status: ReportStatus.ACTION_TAKEN });
    return { message: `Post ${action === 'hide' ? 'hidden' : 'dismissed'}` };
  }

  async sendMessage(sender: User, roomId: string, content: string, imageUrl?: string) {
    const message = this.chatMessageRepository.create({
      roomId,
      sender,
      senderId: sender.id,
      content,
      imageUrl,
    });
    const saved = await this.chatMessageRepository.save(message);
    const formatted = {
      id: saved.id,
      roomId,
      content: saved.content,
      imageUrl: saved.imageUrl,
      author: mapToAuthor(sender),
      createdAt: saved.createdAt,
    };
    this.communityGateway.notifyChatMessage(roomId, formatted);
    return formatted;
  }

  async getChatMessages(roomId: string, page = 1, limit = 50) {
    const [messages, total] = await this.chatMessageRepository.findAndCount({
      where: { roomId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      messages: messages.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        content: m.content,
        imageUrl: m.imageUrl,
        author: mapToAuthor(m.sender),
        createdAt: m.createdAt,
      })),
      total,
      page,
      limit,
    };
  }
}
