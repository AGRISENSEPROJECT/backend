import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { User } from '../entities/user.entity';
import { CommunityGateway } from './community.gateway';

@Injectable()
export class CommunityService {
    constructor(
        @InjectRepository(Post)
        private postRepository: Repository<Post>,
        @InjectRepository(Comment)
        private commentRepository: Repository<Comment>,
        @InjectRepository(Like)
        private likeRepository: Repository<Like>,
        private communityGateway: CommunityGateway,
    ) { }

    async createPost(user: User, description: string, imageUrl?: string): Promise<Post> {
        const post = this.postRepository.create({
            user,
            description,
            imageUrl,
        });
        const savedPost = await this.postRepository.save(post);
        // Fetch with user relation to return complete object
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

    async getAllPosts(): Promise<Post[]> {
        return this.postRepository.find({
            relations: ['user', 'comments', 'likes', 'comments.user'],
            order: { createdAt: 'DESC' },
        });
    }

    async likePost(user: User, postId: string): Promise<Like | null> {
        const post = await this.postRepository.findOne({ where: { id: postId } });
        if (!post) {
            throw new NotFoundException('Post not found');
        }

        const existingLike = await this.likeRepository.findOne({
            where: {
                user: { id: user.id },
                post: { id: postId },
            },
        });

        if (existingLike) {
            // Toggle like (unlike)
            await this.likeRepository.remove(existingLike);
            return null; // OR return a status indicating unliked
        }

        const like = this.likeRepository.create({
            user,
            post,
        });
        const savedLike = await this.likeRepository.save(like);
        this.communityGateway.notifyPostLiked({
            ...savedLike,
            postId: post.id,
            userId: user.id
        });
        return savedLike;
    }

    async commentOnPost(user: User, postId: string, content: string): Promise<Comment> {
        const post = await this.postRepository.findOne({ where: { id: postId } });
        if (!post) {
            throw new NotFoundException('Post not found');
        }

        const comment = this.commentRepository.create({
            user,
            post,
            content,
        });
        const savedComment = await this.commentRepository.save(comment);

        const fullComment = await this.commentRepository.findOne({
            where: { id: savedComment.id },
            relations: ['user']
        })

        if (fullComment) {
            this.communityGateway.notifyPostCommented({
                ...fullComment,
                postId: post.id
            });
            return fullComment;
        }
        return savedComment;
    }
}
