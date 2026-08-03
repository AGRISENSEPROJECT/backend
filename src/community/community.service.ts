import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { CommunityGateway } from './community.gateway';

type AuthorDto = {
  id: string;
  username: string;
  email?: string;
  profileImage?: string | null;
};

@Injectable()
export class CommunityService {
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
    private communityGateway: CommunityGateway,
  ) {}

  private toAuthor(user?: User | null): AuthorDto | null {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      profileImage: user.profileImage ?? null,
    };
  }

  private serializePost(post: Post, currentUserId?: string) {
    const likes = post.likes || [];
    const comments = (post.comments || []).map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: this.toAuthor(comment.user),
      user: this.toAuthor(comment.user),
    }));

    return {
      id: post.id,
      description: post.description,
      imageUrl: post.imageUrl ?? null,
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
      comments,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  async createPost(user: User, description: string) {
    const trimmed = description?.trim();
    if (!trimmed) {
      throw new BadRequestException('Post description is required');
    }

    const post = this.postRepository.create({
      user,
      description: trimmed,
      imageUrl: undefined,
    });
    const saved = await this.postRepository.save(post);
    const fullPost = await this.postRepository.findOne({
      where: { id: saved.id },
      relations: ['user', 'comments', 'likes', 'likes.user', 'comments.user'],
    });

    const serialized = this.serializePost(fullPost!, user.id);
    this.communityGateway.notifyPostCreated(serialized);
    return serialized;
  }

  async getAllPosts(currentUserId?: string, page = 1, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [posts, total] = await this.postRepository.findAndCount({
      relations: ['user', 'comments', 'likes', 'likes.user', 'comments.user'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      items: posts.map((post) => this.serializePost(post, currentUserId)),
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
    if (post.user?.id !== user.id) {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.postRepository.remove(post);
    this.communityGateway.notifyPostDeleted({ id: postId });
    return { deleted: true, id: postId };
  }

  async likePost(user: User, postId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

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
    return payload;
  }

  async commentOnPost(user: User, postId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Comment content is required');

    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const comment = this.commentRepository.create({
      user,
      post,
      content: trimmed,
    });
    const saved = await this.commentRepository.save(comment);
    const fullComment = await this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const serialized = {
      id: fullComment!.id,
      content: fullComment!.content,
      createdAt: fullComment!.createdAt,
      postId: post.id,
      author: this.toAuthor(fullComment!.user),
      user: this.toAuthor(fullComment!.user),
    };
    this.communityGateway.notifyPostCommented(serialized);
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
    return { deleted: true, id: commentId, postId };
  }

  async searchUsers(currentUserId: string, q?: string) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.email', 'user.profileImage'])
      .where('user.id != :currentUserId', { currentUserId })
      .orderBy('user.username', 'ASC')
      .take(20);

    if (q?.trim()) {
      qb.andWhere(
        '(LOWER(user.username) LIKE :q OR LOWER(user.email) LIKE :q)',
        { q: `%${q.trim().toLowerCase()}%` },
      );
    }

    const users = await qb.getMany();
    return users.map((user) => this.toAuthor(user));
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
  ) {
    const members = (conversation.members || []).map((m) => this.toAuthor(m.user));
    const otherMembers = members.filter((m) => m && m.id !== currentUserId);

    return {
      id: conversation.id,
      type: conversation.type,
      name:
        conversation.type === ConversationType.GROUP
          ? conversation.name
          : otherMembers[0]?.username || 'Direct chat',
      members,
      otherMembers,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
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

    const results: Array<ReturnType<CommunityService['serializeConversation']>> = [];
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
        .andWhere('sender.id != :userId', { userId: user.id });

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
      relations: ['members', 'members.user'],
    });
    return this.serializeConversation(full!, user.id);
  }

  async getMessages(user: User, conversationId: string, page = 1, limit = 50) {
    await this.assertMembership(user.id, conversationId);
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversation: { id: conversationId } },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      items: messages
        .map((message) => ({
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          conversationId,
          sender: this.toAuthor(message.sender),
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
      createdAt: saved.createdAt,
      conversationId,
      sender: this.toAuthor(user),
    };

    const memberIds = (conversation.members || [])
      .map((m) => m.user?.id)
      .filter(Boolean) as string[];

    this.communityGateway.notifyMessageCreated(serialized, memberIds);
    return serialized;
  }

  async markConversationRead(user: User, conversationId: string) {
    await this.assertMembership(user.id, conversationId);
    await this.memberRepository.update(
      { conversation: { id: conversationId }, user: { id: user.id } },
      { lastReadAt: new Date() },
    );
    return { ok: true };
  }

  async getConversation(user: User, conversationId: string) {
    await this.assertMembership(user.id, conversationId);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const lastMessage = await this.messageRepository.findOne({
      where: { conversation: { id: conversationId } },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });
    return this.serializeConversation(conversation, user.id, lastMessage, 0);
  }
}
