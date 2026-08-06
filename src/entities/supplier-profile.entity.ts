import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApprovalStatus } from '../common/enums/approval-status.enum';

@Entity('supplier_profiles')
export class SupplierProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column()
  businessName: string;

  @Column({ nullable: true, type: 'text' })
  businessDescription: string | null;

  @Column()
  businessLocation: string;

  @Column()
  businessCategory: string;

  @Column({ nullable: true, type: 'varchar' })
  contactPhone: string | null;

  @Column({ nullable: true, type: 'varchar' })
  contactEmail: string | null;

  @Column({ nullable: true, type: 'varchar' })
  logoUrl: string | null;

  @Column({ nullable: true, type: 'varchar' })
  businessLicenseUrl: string | null;

  @Column({ nullable: true, type: 'simple-array' })
  serviceRegions: string[] | null;

  @Column({ nullable: true, type: 'jsonb' })
  operatingHours: Record<string, string> | null;

  @Column({ default: true })
  deliveryCapability: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus: ApprovalStatus;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  verificationStatus: ApprovalStatus;

  @Column({ nullable: true, type: 'text' })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
