import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanId, PlanLimits } from '../billing/billing.enums';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: PlanId | string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  features: string[];

  /** Integer RWF. 0 for starter. null for enterprise. */
  @Column({ type: 'int', nullable: true })
  priceMonthly: number | null;

  /** Integer RWF per month when billed annually. null for enterprise. */
  @Column({ type: 'int', nullable: true })
  priceAnnualPerMonth: number | null;

  @Column({ type: 'jsonb' })
  limits: PlanLimits;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
