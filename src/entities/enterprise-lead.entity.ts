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
import { EnterpriseLeadStatus } from '../billing/billing.enums';

@Entity('enterprise_leads')
export class EnterpriseLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 160 })
  organizationName: string;

  @Column({ type: 'varchar', length: 160 })
  contactName: string;

  @Column({ type: 'varchar', length: 255 })
  contactEmail: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: EnterpriseLeadStatus.NEW,
  })
  status: EnterpriseLeadStatus | string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
