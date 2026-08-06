import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WaitlistRoleInterest {
  FARMER = 'FARMER',
  SUPPLIER = 'SUPPLIER',
  NGO = 'NGO',
  GOVERNMENT = 'GOVERNMENT',
  OTHER = 'OTHER',
}

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phoneNumber: string | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: WaitlistRoleInterest.FARMER,
  })
  interest: WaitlistRoleInterest | string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  organization: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  province: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source: string | null;

  @Column({ default: false })
  welcomeEmailSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  welcomeEmailSentAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
