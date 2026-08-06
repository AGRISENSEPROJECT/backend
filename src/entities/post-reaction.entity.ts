import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Post } from './post.entity';

export enum ReactionType {
  LIKE = 'like',
  HELPFUL = 'helpful',
  CELEBRATE = 'celebrate',
}

@Entity('post_reactions')
@Unique(['userId', 'postId', 'type'])
export class PostReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  postId: string;

  @Column({ type: 'varchar', length: 32, default: ReactionType.LIKE })
  type: ReactionType | string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Post, (post) => post.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
