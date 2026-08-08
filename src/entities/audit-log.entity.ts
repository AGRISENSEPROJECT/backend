import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditAction {
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  USER_DELETED = 'USER_DELETED',
  USER_RESTORED = 'USER_RESTORED',
  SUPPLIER_APPROVED = 'SUPPLIER_APPROVED',
  SUPPLIER_REJECTED = 'SUPPLIER_REJECTED',
  NGO_APPROVED = 'NGO_APPROVED',
  NGO_REJECTED = 'NGO_REJECTED',
  SUBSCRIPTION_ASSIGNED = 'SUBSCRIPTION_ASSIGNED',
  SUBSCRIPTION_REVOKED = 'SUBSCRIPTION_REVOKED',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
