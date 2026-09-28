import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { FinanceAuditAction, FinanceAuditEntity } from '../finance/finance.enums';

@Entity('finance_audit_logs')
export class FinanceAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  action: FinanceAuditAction | string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  entityType: FinanceAuditEntity | string;

  @Index()
  @Column({ type: 'uuid' })
  entityId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
