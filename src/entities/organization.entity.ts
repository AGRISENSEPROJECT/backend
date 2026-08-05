import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Program } from './program.entity';

export enum OrganizationType {
  NGO = 'ngo',
  GOVERNMENT = 'government',
}

export enum OrganizationVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: OrganizationType,
  })
  type: OrganizationType;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  country: string | null;

  @Column({ nullable: true })
  province: string | null;

  @Column({ nullable: true })
  district: string | null;

  /** Regional scope for NGO assignments (province/district names) */
  @Column({ type: 'jsonb', nullable: true })
  assignedRegions: Array<{ province?: string; district?: string }> | null;

  @Column({
    type: 'enum',
    enum: OrganizationVerificationStatus,
    default: OrganizationVerificationStatus.PENDING,
  })
  verificationStatus: OrganizationVerificationStatus;

  @OneToMany(() => Program, (program) => program.organization)
  programs: Program[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
