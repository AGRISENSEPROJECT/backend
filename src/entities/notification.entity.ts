import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Shared with marketplace/main work. Add new values carefully and
 * keep migration enums in sync when merging branches.
 */
export enum NotificationType {
  SYSTEM = 'system',
  SUPPLIER_APPROVED = 'supplier_approved',
  SUPPLIER_REJECTED = 'supplier_rejected',
  ORDER_PLACED = 'order_placed',
  ORDER_STATUS = 'order_status',
  PREDICTION_READY = 'prediction_ready',
  PREDICTION_FAILED = 'prediction_failed',
  PAYMENT_UPDATE = 'payment_update',
  ORGANIZATION_APPROVED = 'organization_approved',
  ORGANIZATION_REJECTED = 'organization_rejected',
  WEATHER_ALERT = 'weather_alert',
  IOT_ALERT = 'iot_alert',
  // Community
  COMMUNITY_LIKE = 'community_like',
  COMMUNITY_COMMENT = 'community_comment',
  COMMUNITY_REPLY = 'community_reply',
  COMMUNITY_MENTION = 'community_mention',
  COMMUNITY_MESSAGE = 'community_message',
  COMMUNITY_GROUP_INVITE = 'community_group_invite',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'varchar',
    length: 64,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType | string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
