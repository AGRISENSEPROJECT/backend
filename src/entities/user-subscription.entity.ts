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
import { SubscriptionPlan } from './subscription-plan.entity';
import {
  BillingCycle,
  PaymentMethodType,
  PlanId,
  SubscriptionStatus,
} from '../billing/billing.enums';

@Entity('user_subscriptions')
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 40 })
  planId: PlanId | string;

  @ManyToOne(() => SubscriptionPlan, { eager: true })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({ type: 'varchar', length: 20, nullable: true })
  billingCycle: BillingCycle | null;

  @Column({ type: 'varchar', length: 30, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus | string;

  @Column({ type: 'varchar', length: 20, default: PaymentMethodType.NONE })
  paymentMethod: PaymentMethodType | string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerCustomerId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerSubscriptionId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerPaymentRef: string | null;

  /** Integer RWF amount for the current/pending period charge. */
  @Column({ type: 'int', default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 8, default: 'RWF' })
  currency: string;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  /** Masked label only, e.g. "MTN MoMo · 078***1234" */
  @Column({ type: 'varchar', length: 120, nullable: true })
  paymentLabel: string | null;

  @Column({ default: true })
  isCurrent: boolean;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
