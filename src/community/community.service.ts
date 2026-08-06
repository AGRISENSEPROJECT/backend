import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { User } from '../entities/user.entity';
import {
  Conversation,
  ConversationType,
} from '../entities/conversation.entity';
import { ConversationMember } from '../entities/conversation-member.entity';
import { Message } from '../entities/message.entity';
import { UserBlock } from '../entities/user-block.entity';
import {
  PostReaction,
  ReactionType,
} from '../entities/post-reaction.entity';
import { MessageReceipt } from '../entities/message-receipt.entity';
import { NotificationType } from '../entities/notification.entity';
import { NotificationService } from '../notification/notification.service';
import { CloudinaryService } from '../auth/cloudinary.service';
import { CommunityGateway } from './community.gateway';
import { PostReport, ReportStatus } from '../entities/post-report.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { ReportPostDto } from './dto/create-post.dto';
import { mapToAuthor, userDisplayName } from '../common/utils/author.mapper';

type AuthorDto = NonNullable<ReturnType<typeof mapToAuthor>>;

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private memberRepository: Repository<ConversationMember>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(UserBlock)
    private blockRepository: Repository<UserBlock>,
    @InjectRepository(PostReaction)
    private reactionRepository: Repository<PostReaction>,
    @InjectRepository(MessageReceipt)
    private receiptRepository: Repository<MessageReceipt>,
    @InjectRepository(PostReport)
    private reportRepository: Repository<PostReport>,
    private communityGateway: CommunityGateway,
    private notificationService: NotificationService,
    private cloudinaryService: CloudinaryService,
  ) {}

  private toAuthor(user?: User | null): AuthorDto | null {
    return mapToAuthor(user);
  }

  private displayName(user: User): string {
    return userDisplayName(user);
  }

  private extractHashtags(text: string): string[] {
    const matches = text.match(/#[\w]+/g) || [];
    return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase())));
  }

  private extractMentions(text: string): string[] {
    const matches = text.match(/@[\w.-]+/g) || [];
    return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase())));
  }

  private async notifySafe(
    ...args: Parameters<NotificationService['create']>
  ) {
    try {
      await this.notificationService.create(...args);
    } catch (error) {
      this.logger.warn(
        `Failed to create notification: ${(error as Error).message}`,
      );
    }
  }

  private async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const rows = await this.blockRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.blockerId === userId) ids.add(row.blockedId);
      if (row.blockedId === userId) ids.add(row.blockerId);
    }
    return ids;
  }

  private async assertNotBlocked(actorId: string, otherUserId: string) {
    const block = await this.blockRepository.findOne({
      where: [
        { blockerId: actorId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: actorId },
      ],
    });
    if (block) {
      throw new ForbiddenException('You cannot interact with this user');
    }
  }

  private serializeComment(comment: Comment) {
    return {
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId ?? null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: this.toAuthor(comment.user),
      user: this.toAuthor(comment.user),
    };
  }

  private serializePost(post: Post, currentUserId?: string) {
    const likes = post.likes || [];
    const reactions = post.reactions || [];
    const comments = (post.comments || []).map((c) => this.serializeComment(c));

    const reactionCounts: Record<string, number> = {};
    for (const reaction of reactions) {
      reactionCounts[reaction.type] = (reactionCounts[reaction.type] || 0) + 1;
    }

    return {
      id: post.id,
      title: post.title ?? null,
      description: post.description,
      imageUrl: post.imageUrl ?? null,
      hashtags: post.hashtags ?? [],
      mentions: post.mentions ?? [],
      author: this.toAuthor(post.user),
      user: this.toAuthor(post.user),
      likes: likes.map((like) => ({
        id: like.id,
        user: this.toAuthor(like.user),
      })),
      likeCount: likes.length,
      commentCount: comments.length,
      likedByMe: currentUserId
        ? likes.some((like) => like.user?.id === currentUserId)
        : false,
      reactions: reactions.map((r) => ({
        id: r.id,
        type: r.type,
        user: this.toAuthor(r.user),
      })),
      reactionCounts,
      myReactions: currentUserId
        ? reactions
            .filter((r) => r.user?.id === currentUserId)
            .map((r) => r.type)
        : [],
      comments,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private async loadPost(postId: string) {
    return this.postRepository.findOne({
      where: { id: postId },
      relations: [
        'user',
        'comments',
        'comments.user',
        'likes',
        'likes.user',
        'reactions',
        'reactions.user',
      ],
    });
  }

  async createPost(
    user: User,
    title: string,
    description: string,
    image?: Express.Multer.File,
  ) {
    const trimmedTitle = title?.trim();
    const trimmed = description?.trim();
    if (!trimmedTitle) {
      throw new BadRequestException('Post title is required');
    }
    if (!trimmed) {
      throw new BadRequestException('Post description is required');
    }
    if (!image) {
      throw new BadRequestException(
        'A cover image is required for community posts',
      );
    }

    const hashtags = this.extractHashtags(`${trimmedTitle} ${trimmed}`);
    const mentionUsernames = this.extractMentions(trimmed);
    const imageUrl = await this.cloudinaryService.uploadPostImage(image);

    const post = this.postRepository.create({
      user,
      title: trimmedTitle,
      description: trimmed,
      imageUrl,
      hashtags,
      mentions: mentionUsernames,
    });
    const saved = await this.postRepository.save(post);
    const fullPost = await this.loadPost(saved.id);
    const serialized = this.serializePost(fullPost!, user.id);
    this.communityGateway.notifyPostCreated(serialized);

    if (mentionUsernames.length > 0) {
      const mentioned = await this.userRepository
        .createQueryBuilder('user')
        .where('LOWER(user.email) IN (:...names)', { names: mentionUsernames })
        .orWhere('LOWER(user.firstName) IN (:...names)', { names: mentionUsernames })
        .orWhere('LOWER(user.lastName) IN (:...names)', { names: mentionUsernames })
        .getMany();

      for (const target of mentioned) {
        if (target.id === user.id) continue;
        await this.notifySafe({
          userId: target.id,
          type: NotificationType.COMMUNITY_MENTION,
          title: 'You were mentioned',
          message: `${this.displayName(user)} mentioned you in a post`,
          data: { postId: saved.id, actorId: user.id },
        });
      }
    }

    return serialized;
  }

  async updatePost(
    user: User,
    postId: string,
    description: string,
    image?: Express.Multer.File,
    title?: string,
  ) {
    const trimmed = description?.trim();
    if (!trimmed) {
      throw new BadRequestException('Post description is required');
    }

    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id !== user.id) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (title !== undefined) {
      const trimmedTitle = title?.trim();
      if (!trimmedTitle) {
        throw new BadRequestException('Post title is required');
      }
      post.title = trimmedTitle;
    }

    post.description = trimmed;
    post.hashtags = this.extractHashtags(
      `${post.title || ''} ${trimmed}`.trim(),
    );
    post.mentions = this.extractMentions(trimmed);

    if (image) {
      const previousUrl = post.imageUrl;
      post.imageUrl = await this.cloudinaryService.uploadPostImage(image);
      if (previousUrl) {
        await this.cloudinaryService.deleteImage(previousUrl);
      }
    }

    await this.postRepository.save(post);

    const full = await this.loadPost(postId);
    const serialized = this.serializePost(full!, user.id);
    this.communityGateway.notifyPostUpdated(serialized);
    return serialized;
  }

  async getAllPosts(
    currentUserId?: string,
    page = 1,
    limit = 30,
    q?: string,
    hashtag?: string,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const blocked = currentUserId
      ? await this.getBlockedUserIds(currentUserId)
      : new Set<string>();

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .where('post.isHidden = :hidden', { hidden: false })
      .leftJoinAndSelect('post.comments', 'comments')
      .leftJoinAndSelect('comments.user', 'commentUser')
      .leftJoinAndSelect('post.likes', 'likes')
      .leftJoinAndSelect('likes.user', 'likeUser')
      .leftJoinAndSelect('post.reactions', 'reactions')
      .leftJoinAndSelect('reactions.user', 'reactionUser')
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (q?.trim()) {
      qb.andWhere(
        '(LOWER(post.description) LIKE :q OR LOWER(COALESCE(post.title, \'\')) LIKE :q)',
        {
          q: `%${q.trim().toLowerCase()}%`,
        },
      );
    }
    if (hashtag?.trim()) {
      const tag = hashtag.replace(/^#/, '').toLowerCase();
      qb.andWhere(`post.hashtags @> :tag::jsonb`, {
        tag: JSON.stringify([tag]),
      });
    }

    const [posts, total] = await qb.getManyAndCount();
    const filtered = posts.filter((p) => !blocked.has(p.user?.id));

    return {
      items: filtered.map((post) => this.serializePost(post, currentUserId)),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  async deletePost(user: User, postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    const imageUrl = post.imageUrl;

    // Remove dependent rows first (DB FKs may not all be ON DELETE CASCADE yet)
    await this.commentRepository.delete({ post: { id: postId } });
    await this.likeRepository.delete({ post: { id: postId } });
    await this.reactionRepository.delete({ postId });
    await this.postRepository.delete(postId);

    if (imageUrl) {
      await this.cloudinaryService.deleteImage(imageUrl);
    }
    this.communityGateway.notifyPostDeleted({ id: postId });
    return { deleted: true, id: postId };
  }

  async sharePost(user: User, postId: string) {
    const post = await this.loadPost(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id) {
      await this.assertNotBlocked(user.id, post.user.id);
    }

    const base =
      process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://agrisense.rw';
    return {
      postId,
      shareUrl: `${base}/community/posts/${postId}`,
      description: post.description,
      author: this.toAuthor(post.user),
    };
  }

  async likePost(user: User, postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id) {
      await this.assertNotBlocked(user.id, post.user.id);
    }

    const existingLike = await this.likeRepository.findOne({
      where: { user: { id: user.id }, post: { id: postId } },
      relations: ['user'],
    });

    if (existingLike) {
      await this.likeRepository.remove(existingLike);
      const likeCount = await this.likeRepository.count({
        where: { post: { id: postId } },
      });
      const payload = {
        postId,
        userId: user.id,
        liked: false,
        likeCount,
      };
      this.communityGateway.notifyPostUnliked(payload);
      return payload;
    }

    const like = this.likeRepository.create({ user, post });
    await this.likeRepository.save(like);
    const likeCount = await this.likeRepository.count({
      where: { post: { id: postId } },
    });
    const payload = {
      postId,
      userId: user.id,
      liked: true,
      likeCount,
      user: this.toAuthor(user),
    };
    this.communityGateway.notifyPostLiked(payload);

    if (post.user?.id && post.user.id !== user.id) {
      await this.notifySafe({
        userId: post.user.id,
        type: NotificationType.COMMUNITY_LIKE,
        title: 'New like',
        message: `${this.displayName(user)} liked your post`,
        data: { postId, actorId: user.id },
      });
    }

    return payload;
  }

  async reactToPost(
    user: User,
    postId: string,
    type: ReactionType | string = ReactionType.LIKE,
  ) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id) {
      await this.assertNotBlocked(user.id, post.user.id);
    }

    const existing = await this.reactionRepository.findOne({
      where: {
        userId: user.id,
        postId,
        type,
      },
    });

    if (existing) {
      await this.reactionRepository.remove(existing);
      const counts = await this.reactionCounts(postId);
      const payload = {
        postId,
        userId: user.id,
        type,
        reacted: false,
        reactionCounts: counts,
      };
      this.communityGateway.notifyPostReaction(payload);
      return payload;
    }

    await this.reactionRepository.save(
      this.reactionRepository.create({
        userId: user.id,
        postId,
        type,
        user,
        post,
      }),
    );

    const counts = await this.reactionCounts(postId);
    const payload = {
      postId,
      userId: user.id,
      type,
      reacted: true,
      reactionCounts: counts,
      user: this.toAuthor(user),
    };
    this.communityGateway.notifyPostReaction(payload);

    if (post.user?.id && post.user.id !== user.id) {
      await this.notifySafe({
        userId: post.user.id,
        type: NotificationType.COMMUNITY_LIKE,
        title: 'New reaction',
        message: `${this.displayName(user)} reacted (${type}) to your post`,
        data: { postId, actorId: user.id, reaction: type },
      });
    }

    return payload;
  }

  private async reactionCounts(postId: string) {
    const rows = await this.reactionRepository.find({ where: { postId } });
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.type] = (counts[row.type] || 0) + 1;
    }
    return counts;
  }

  async commentOnPost(
    user: User,
    postId: string,
    content: string,
    parentId?: string,
  ) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Comment content is required');

    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.user?.id) {
      await this.assertNotBlocked(user.id, post.user.id);
    }

    let parent: Comment | null = null;
    if (parentId) {
      parent = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ['user', 'post'],
      });
      if (!parent || parent.post?.id !== postId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    const comment = this.commentRepository.create({
      user,
      post,
      content: trimmed,
      parentId: parentId ?? null,
      parent: parent ?? null,
    });
    const saved = await this.commentRepository.save(comment);
    const fullComment = await this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const serialized = {
      ...this.serializeComment(fullComment!),
      postId: post.id,
    };
    this.communityGateway.notifyPostCommented(serialized);

    if (parent?.user?.id && parent.user.id !== user.id) {
      await this.notifySafe({
        userId: parent.user.id,
        type: NotificationType.COMMUNITY_REPLY,
        title: 'New reply',
        message: `${this.displayName(user)} replied to your comment`,
        data: {
          postId: post.id,
          commentId: saved.id,
          parentId,
          actorId: user.id,
        },
      });
    } else if (post.user?.id && post.user.id !== user.id) {
      await this.notifySafe({
        userId: post.user.id,
        type: NotificationType.COMMUNITY_COMMENT,
        title: 'New comment',
        message: `${this.displayName(user)} commented on your post`,
        data: { postId: post.id, commentId: saved.id, actorId: user.id },
      });
    }

    return serialized;
  }

  async updateComment(user: User, commentId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Comment content is required');

    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'post'],
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.user?.id !== user.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.content = trimmed;
    await this.commentRepository.save(comment);
    const serialized = {
      ...this.serializeComment(comment),
      postId: comment.post?.id,
    };
    this.communityGateway.notifyCommentUpdated(serialized);
    return serialized;
  }

  async deleteComment(user: User, commentId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'post'],
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.user?.id !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    const postId = comment.post?.id;
    await this.commentRepository.remove(comment);
    this.communityGateway.notifyCommentDeleted({ id: commentId, postId });
    return { deleted: true, id: commentId, postId };
  }

  async blockUser(user: User, targetUserId: string) {
    if (targetUserId === user.id) {
      throw new BadRequestException('Cannot block yourself');
    }
    const target = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.blockRepository.findOne({
      where: { blockerId: user.id, blockedId: targetUserId },
    });
    if (existing) {
      return { blocked: true, userId: targetUserId };
    }

    await this.blockRepository.save(
      this.blockRepository.create({
        blockerId: user.id,
        blockedId: targetUserId,
      }),
    );
    return { blocked: true, userId: targetUserId };
  }

  async unblockUser(user: User, targetUserId: string) {
    await this.blockRepository.delete({
      blockerId: user.id,
      blockedId: targetUserId,
    });
    return { blocked: false, userId: targetUserId };
  }

  async listBlockedUsers(user: User) {
    const blocks = await this.blockRepository.find({
      where: { blockerId: user.id },
      relations: ['blocked'],
      order: { createdAt: 'DESC' },
    });
    return blocks.map((b) => this.toAuthor(b.blocked));
  }

  async searchUsers(currentUserId: string, q?: string) {
    const blocked = await this.getBlockedUserIds(currentUserId);
    const qb = this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.firstName', 'user.lastName', 'user.email', 'user.profileImage'])
      .where('user.id != :currentUserId', { currentUserId })
      .orderBy('user.firstName', 'ASC')
      .addOrderBy('user.lastName', 'ASC')
      .take(20);

    if (q?.trim()) {
      qb.andWhere(
        '(LOWER(user.email) LIKE :q OR LOWER(user.firstName) LIKE :q OR LOWER(user.lastName) LIKE :q)',
        { q: `%${q.trim().toLowerCase()}%` },
      );
    }

    const users = await qb.getMany();
    return users
      .filter((u) => !blocked.has(u.id))
      .map((user) => ({
        ...this.toAuthor(user),
        online: this.communityGateway.isUserOnline(user.id),
      }));
  }

  private async assertMembership(userId: string, conversationId: string) {
    const member = await this.memberRepository.findOne({
      where: {
        user: { id: userId },
        conversation: { id: conversationId },
      },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
    return member;
  }

  private serializeConversation(
    conversation: Conversation,
    currentUserId: string,
    lastMessage?: Message | null,
    unreadCount = 0,
    muted = false,
  ) {
    const members = (conversation.members || []).map((m) => this.toAuthor(m.user));
    const otherMembers = members.filter((m) => m && m.id !== currentUserId);

    return {
      id: conversation.id,
      type: conversation.type,
      name:
        conversation.type === ConversationType.GROUP
          ? conversation.name
          : [otherMembers[0]?.firstName, otherMembers[0]?.lastName]
              .filter(Boolean)
              .join(' ') || otherMembers[0]?.email || 'Direct chat',
      imageUrl: conversation.imageUrl ?? null,
      createdById: conversation.createdBy?.id ?? null,
      members,
      otherMembers,
      muted,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.deletedAt ? '[deleted]' : lastMessage.content,
            createdAt: lastMessage.createdAt,
            deletedAt: lastMessage.deletedAt ?? null,
            sender: this.toAuthor(lastMessage.sender),
          }
        : null,
      unreadCount,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
    };
  }

  async listConversations(user: User, type?: 'direct' | 'group') {
    const memberships = await this.memberRepository.find({
      where: { user: { id: user.id } },
      relations: [
        'conversation',
        'conversation.members',
        'conversation.members.user',
        'conversation.createdBy',
      ],
      order: { joinedAt: 'DESC' },
    });

    let conversations = memberships.map((m) => m.conversation);
    if (type) {
      conversations = conversations.filter((c) => c.type === type);
    }

    const results: Array<ReturnType<CommunityService['serializeConversation']>> =
      [];
    for (const conversation of conversations) {
      const lastMessage = await this.messageRepository.findOne({
        where: { conversation: { id: conversation.id } },
        relations: ['sender'],
        order: { createdAt: 'DESC' },
      });

      const myMembership = memberships.find(
        (m) => m.conversation.id === conversation.id,
      );
      const unreadQb = this.messageRepository
        .createQueryBuilder('message')
        .innerJoin('message.conversation', 'conversation')
        .innerJoin('message.sender', 'sender')
        .where('conversation.id = :conversationId', {
          conversationId: conversation.id,
        })
        .andWhere('sender.id != :userId', { userId: user.id })
        .andWhere('message.deletedAt IS NULL');

      if (myMembership?.lastReadAt) {
        unreadQb.andWhere('message.createdAt > :lastReadAt', {
          lastReadAt: myMembership.lastReadAt,
        });
      }
      const unreadCount = await unreadQb.getCount();

      results.push(
        this.serializeConversation(
          conversation,
          user.id,
          lastMessage,
          unreadCount,
          !!myMembership?.mutedAt,
        ),
      );
    }

    results.sort((a, b) => {
      const aTime = new Date(
        a.lastMessage?.createdAt || a.updatedAt,
      ).getTime();
      const bTime = new Date(
        b.lastMessage?.createdAt || b.updatedAt,
      ).getTime();
      return bTime - aTime;
    });

    return results;
  }

  async createDirectConversation(user: User, otherUserId: string) {
    if (otherUserId === user.id) {
      throw new BadRequestException('Cannot start a chat with yourself');
    }
    await this.assertNotBlocked(user.id, otherUserId);

    const other = await this.userRepository.findOne({
      where: { id: otherUserId },
    });
    if (!other) throw new NotFoundException('User not found');

    const existing = await this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.members', 'm1')
      .innerJoin('m1.user', 'u1')
      .innerJoin('conversation.members', 'm2')
      .innerJoin('m2.user', 'u2')
      .leftJoinAndSelect('conversation.members', 'members')
      .leftJoinAndSelect('members.user', 'memberUser')
      .where('conversation.type = :type', { type: ConversationType.DIRECT })
      .andWhere('u1.id = :me', { me: user.id })
      .andWhere('u2.id = :other', { other: otherUserId })
      .getOne();

    if (existing) {
      return this.serializeConversation(existing, user.id);
    }

    const conversation = this.conversationRepository.create({
      type: ConversationType.DIRECT,
      name: null,
      createdBy: user,
      members: [
        this.memberRepository.create({ user, lastReadAt: new Date() }),
        this.memberRepository.create({ user: other, lastReadAt: null }),
      ],
    });
    const saved = await this.conversationRepository.save(conversation);
    const full = await this.conversationRepository.findOne({
      where: { id: saved.id },
      relations: ['members', 'members.user'],
    });
    return this.serializeConversation(full!, user.id);
  }

  async createGroupConversation(
    user: User,
    name: string,
    memberIds: string[],
  ) {
    const uniqueIds = Array.from(
      new Set(memberIds.filter((id) => id && id !== user.id)),
    );
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Add at least one other member');
    }

    for (const id of uniqueIds) {
      await this.assertNotBlocked(user.id, id);
    }

    const members = await this.userRepository.find({
      where: { id: In(uniqueIds) },
    });
    if (members.length !== uniqueIds.length) {
      throw new BadRequestException('One or more members were not found');
    }

    const conversation = this.conversationRepository.create({
      type: ConversationType.GROUP,
      name: name.trim(),
      createdBy: user,
      members: [
        this.memberRepository.create({ user, lastReadAt: new Date() }),
        ...members.map((member) =>
          this.memberRepository.create({ user: member, lastReadAt: null }),
        ),
      ],
    });

    const saved = await this.conversationRepository.save(conversation);
    const full = await this.conversationRepository.findOne({
      where: { id: saved.id },
      relations: ['members', 'members.user', 'createdBy'],
    });

    for (const member of members) {
      await this.notifySafe({
        userId: member.id,
        type: NotificationType.COMMUNITY_GROUP_INVITE,
        title: 'Added to group',
        message: `${this.displayName(user)} added you to ${name.trim()}`,
        data: { conversationId: saved.id, actorId: user.id },
      });
    }

    return this.serializeConversation(full!, user.id);
  }

  private async assertGroupAdmin(user: User, conversation: Conversation) {
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Only group conversations support this');
    }
    if (conversation.createdBy?.id !== user.id) {
      throw new ForbiddenException('Only the group creator can do this');
    }
  }

  async renameGroup(user: User, conversationId: string, name: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertMembership(user.id, conversationId);
    await this.assertGroupAdmin(user, conversation);

    conversation.name = name.trim();
    await this.conversationRepository.save(conversation);
    const serialized = this.serializeConversation(conversation, user.id);
    this.communityGateway.notifyConversationUpdated(serialized, this.memberIds(conversation));
    return serialized;
  }

  async updateGroupImage(
    user: User,
    conversationId: string,
    image: Express.Multer.File,
  ) {
    if (!image) {
      throw new BadRequestException('Group image is required');
    }
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertMembership(user.id, conversationId);
    await this.assertGroupAdmin(user, conversation);

    const previousUrl = conversation.imageUrl;
    conversation.imageUrl = await this.cloudinaryService.uploadPostImage(image);
    await this.conversationRepository.save(conversation);
    if (previousUrl) {
      await this.cloudinaryService.deleteImage(previousUrl);
    }

    const serialized = this.serializeConversation(conversation, user.id);
    this.communityGateway.notifyConversationUpdated(
      serialized,
      this.memberIds(conversation),
    );
    return serialized;
  }

  async addGroupMembers(user: User, conversationId: string, memberIds: string[]) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertMembership(user.id, conversationId);
    await this.assertGroupAdmin(user, conversation);

    const existing = new Set(
      (conversation.members || []).map((m) => m.user?.id).filter(Boolean),
    );
    const uniqueIds = Array.from(
      new Set(memberIds.filter((id) => id && !existing.has(id))),
    );
    if (uniqueIds.length === 0) {
      return this.serializeConversation(conversation, user.id);
    }

    const users = await this.userRepository.find({
      where: { id: In(uniqueIds) },
    });
    for (const member of users) {
      await this.memberRepository.save(
        this.memberRepository.create({
          conversation,
          user: member,
          lastReadAt: null,
        }),
      );
      await this.notifySafe({
        userId: member.id,
        type: NotificationType.COMMUNITY_GROUP_INVITE,
        title: 'Added to group',
        message: `${this.displayName(user)} added you to ${conversation.name}`,
        data: { conversationId, actorId: user.id },
      });
    }

    const full = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user', 'createdBy'],
    });
    const serialized = this.serializeConversation(full!, user.id);
    this.communityGateway.notifyConversationUpdated(
      serialized,
      this.memberIds(full!),
    );
    return serialized;
  }

  async removeGroupMembers(
    user: User,
    conversationId: string,
    memberIds: string[],
  ) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertMembership(user.id, conversationId);
    await this.assertGroupAdmin(user, conversation);

    const toRemove = memberIds.filter((id) => id !== user.id);
    if (toRemove.length) {
      await this.memberRepository
        .createQueryBuilder()
        .delete()
        .where('"conversationId" = :conversationId', { conversationId })
        .andWhere('"userId" IN (:...ids)', { ids: toRemove })
        .execute();
    }

    const full = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user', 'createdBy'],
    });
    const serialized = this.serializeConversation(full!, user.id);
    this.communityGateway.notifyConversationUpdated(serialized, [
      ...this.memberIds(full!),
      ...toRemove,
    ]);
    return serialized;
  }

  async leaveConversation(user: User, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertMembership(user.id, conversationId);

    if (
      conversation.type === ConversationType.GROUP &&
      conversation.createdBy?.id === user.id
    ) {
      throw new BadRequestException(
        'Group creator cannot leave — delete the group or transfer ownership first',
      );
    }

    await this.memberRepository.delete({
      conversation: { id: conversationId },
      user: { id: user.id },
    });

    if (conversation.type === ConversationType.DIRECT) {
      // Keep the conversation shell; other user still sees history
    }

    return { left: true, conversationId };
  }

  async deleteGroup(user: User, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertGroupAdmin(user, conversation);
    const memberIds = this.memberIds(conversation);
    await this.conversationRepository.remove(conversation);
    this.communityGateway.notifyConversationDeleted(
      { id: conversationId },
      memberIds,
    );
    return { deleted: true, id: conversationId };
  }

  async muteConversation(user: User, conversationId: string, muted = true) {
    await this.assertMembership(user.id, conversationId);
    await this.memberRepository.update(
      { conversation: { id: conversationId }, user: { id: user.id } },
      { mutedAt: muted ? new Date() : null },
    );
    return { conversationId, muted };
  }

  private memberIds(conversation: Conversation): string[] {
    return (conversation.members || [])
      .map((m) => m.user?.id)
      .filter(Boolean) as string[];
  }

  async getMessages(user: User, conversationId: string, page = 1, limit = 50) {
    await this.assertMembership(user.id, conversationId);
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversation: { id: conversationId } },
      relations: ['sender', 'receipts', 'receipts.user'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      items: messages
        .map((message) => ({
          id: message.id,
          content: message.deletedAt ? '[deleted]' : message.content,
          deletedAt: message.deletedAt ?? null,
          editedAt: message.editedAt ?? null,
          createdAt: message.createdAt,
          conversationId,
          sender: this.toAuthor(message.sender),
          receipts: (message.receipts || []).map((r) => ({
            userId: r.userId,
            readAt: r.readAt,
            user: this.toAuthor(r.user),
          })),
        }))
        .reverse(),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  async sendMessage(user: User, conversationId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Message content is required');

    await this.assertMembership(user.id, conversationId);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const message = this.messageRepository.create({
      conversation,
      sender: user,
      content: trimmed,
    });
    const saved = await this.messageRepository.save(message);

    conversation.updatedAt = new Date();
    await this.conversationRepository.save(conversation);

    await this.memberRepository.update(
      { conversation: { id: conversationId }, user: { id: user.id } },
      { lastReadAt: new Date() },
    );

    const serialized = {
      id: saved.id,
      content: saved.content,
      deletedAt: null,
      editedAt: null,
      createdAt: saved.createdAt,
      conversationId,
      sender: this.toAuthor(user),
      receipts: [],
    };

    const memberIds = this.memberIds(conversation);
    this.communityGateway.notifyMessageCreated(serialized, memberIds);

    const mutedMembers = new Set(
      (conversation.members || [])
        .filter((m) => m.mutedAt)
        .map((m) => m.user?.id)
        .filter(Boolean) as string[],
    );

    for (const memberId of memberIds) {
      if (memberId === user.id || mutedMembers.has(memberId)) continue;
      await this.notifySafe({
        userId: memberId,
        type: NotificationType.COMMUNITY_MESSAGE,
        title: 'New message',
        message: `${this.displayName(user)}: ${trimmed.slice(0, 120)}`,
        data: {
          conversationId,
          messageId: saved.id,
          actorId: user.id,
        },
      });
    }

    return serialized;
  }

  async deleteMessage(user: User, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'conversation', 'conversation.members', 'conversation.members.user'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.sender?.id !== user.id) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    message.deletedAt = new Date();
    await this.messageRepository.save(message);

    const payload = {
      id: message.id,
      conversationId: message.conversation.id,
      deletedAt: message.deletedAt,
    };
    this.communityGateway.notifyMessageDeleted(
      payload,
      this.memberIds(message.conversation),
    );
    return payload;
  }

  async updateMessage(user: User, messageId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Message content is required');

    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: [
        'sender',
        'conversation',
        'conversation.members',
        'conversation.members.user',
      ],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    if (message.sender?.id !== user.id) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    message.content = trimmed;
    message.editedAt = new Date();
    await this.messageRepository.save(message);

    const serialized = {
      id: message.id,
      conversationId: message.conversation.id,
      content: message.content,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: null,
      sender: this.toAuthor(message.sender),
    };

    const memberIds = this.memberIds(message.conversation);
    this.communityGateway.notifyMessageUpdated(serialized, memberIds);

    return serialized;
  }

  async markConversationRead(user: User, conversationId: string) {
    await this.assertMembership(user.id, conversationId);
    const now = new Date();
    await this.memberRepository.update(
      { conversation: { id: conversationId }, user: { id: user.id } },
      { lastReadAt: now },
    );

    const unread = await this.messageRepository.find({
      where: {
        conversation: { id: conversationId },
        deletedAt: IsNull(),
      },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const toReceipt = unread.filter((m) => m.sender?.id !== user.id);
    for (const message of toReceipt) {
      const existing = await this.receiptRepository.findOne({
        where: { messageId: message.id, userId: user.id },
      });
      if (!existing) {
        await this.receiptRepository.save(
          this.receiptRepository.create({
            messageId: message.id,
            userId: user.id,
            readAt: now,
          }),
        );
      }
    }

    if (toReceipt.length > 0) {
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
        relations: ['members', 'members.user'],
      });
      this.communityGateway.notifyMessagesRead(
        {
          conversationId,
          userId: user.id,
          messageIds: toReceipt.map((m) => m.id),
          readAt: now,
        },
        this.memberIds(conversation!),
      );
    }

    return { ok: true };
  }

  async getConversation(user: User, conversationId: string) {
    const membership = await this.assertMembership(user.id, conversationId);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user', 'createdBy'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const lastMessage = await this.messageRepository.findOne({
      where: { conversation: { id: conversationId } },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });
    return this.serializeConversation(
      conversation,
      user.id,
      lastMessage,
      0,
      !!membership.mutedAt,
    );
  }

  getOnlineUserIds() {
    return this.communityGateway.getOnlineUserIds();
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
      reason: dto.reason as any,
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
      this.communityGateway.notifyPostDeleted({ id: postId });
    }

    await this.reportRepository.update({ postId }, { status: ReportStatus.ACTION_TAKEN });
    return { message: `Post ${action === 'hide' ? 'hidden' : 'dismissed'}` };
  }
}
