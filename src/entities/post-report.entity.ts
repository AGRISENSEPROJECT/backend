import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Post } from './post.entity';
import { User } from './user.entity';

export enum PostReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
  ACTIONED = 'actioned',
}

@Entity('post_reports')
export class PostReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column()
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column()
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({
    type: 'enum',
    enum: PostReportStatus,
    default: PostReportStatus.PENDING,
  })
  status: PostReportStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
