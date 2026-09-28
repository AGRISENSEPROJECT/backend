import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { FinanceAccountType } from '../finance/finance.enums';
import { FinanceTransaction } from './finance-transaction.entity';

@Entity('finance_accounts')
export class FinanceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  type: FinanceAccountType | string;

  @Column({ type: 'varchar', length: 8, default: 'RWF' })
  currency: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  institution: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  accountNumber: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @OneToMany(() => FinanceTransaction, (txn) => txn.account)
  transactions: FinanceTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
