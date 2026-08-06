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
import { Message } from './message.entity';

@Entity('message_receipts')
@Unique(['messageId', 'userId'])
export class MessageReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  messageId: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => Message, (message) => message.receipts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  readAt: Date;
}
