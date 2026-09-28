import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { FinanceAccount } from './finance-account.entity';
import { FinanceCategory } from './finance-category.entity';
import {
  FinanceTransactionStatus,
  FinanceTransactionType,
} from '../finance/finance.enums';

@Entity('finance_transactions')
export class FinanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  type: FinanceTransactionType | string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: FinanceTransactionStatus | string;

  /** Whole RWF, same convention as billing. */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 8, default: 'RWF' })
  currency: string;

  @Index()
  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'varchar', length: 240 })
  description: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  counterparty: string | null;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => FinanceAccount, (account) => account.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'accountId' })
  account: FinanceAccount;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => FinanceCategory, (category) => category.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: FinanceCategory;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejectedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  cancelledById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
