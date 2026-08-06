import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';

@Entity('conversation_members')
@Unique(['conversation', 'user'])
export class ConversationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.members, {
    onDelete: 'CASCADE',
  })
  conversation: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  mutedAt: Date | null;

  @CreateDateColumn()
  joinedAt: Date;
}
