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
import { Product } from './product.entity';

export enum SupplierVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('supplier_profiles')
export class SupplierProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.supplierProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  businessName: string;

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

  @Column({ nullable: true })
  sector: string | null;

  @Column({ nullable: true })
  cell: string | null;

  @Column({ nullable: true })
  village: string | null;

  @Column({ nullable: true })
  address: string | null;

  @Column({
    type: 'enum',
    enum: SupplierVerificationStatus,
    default: SupplierVerificationStatus.PENDING,
  })
  verificationStatus: SupplierVerificationStatus;

  @OneToMany(() => Product, (product) => product.supplierProfile)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
