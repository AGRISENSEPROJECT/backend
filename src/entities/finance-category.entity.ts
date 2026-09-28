import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { FinanceCategoryKind } from '../finance/finance.enums';
import { FinanceTransaction } from './finance-transaction.entity';

@Entity('finance_categories')
@Unique('UQ_finance_categories_name_kind', ['name', 'kind'])
export class FinanceCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  kind: FinanceCategoryKind | string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @OneToMany(() => FinanceTransaction, (txn) => txn.category)
  transactions: FinanceTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
