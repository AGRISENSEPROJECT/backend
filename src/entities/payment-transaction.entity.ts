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
import { UserSubscription } from './user-subscription.entity';
import {
  PaymentMethodType,
  PaymentTransactionStatus,
} from '../billing/billing.enums';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ nullable: true })
  subscriptionId: string | null;

  @ManyToOne(() => UserSubscription, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: UserSubscription | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 8, default: 'RWF' })
  currency: string;

  @Column({ type: 'varchar', length: 20 })
  method: PaymentMethodType | string;

  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentTransactionStatus.INITIATED,
  })
  status: PaymentTransactionStatus | string;

  @Column({ type: 'varchar', length: 40, default: 'flutterwave' })
  provider: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160, unique: true })
  providerRef: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  checkoutId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawWebhookPayload: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  paymentLabel: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
