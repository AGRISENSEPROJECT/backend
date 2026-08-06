import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Farm } from './farm.entity';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { Like } from './like.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { IdentityVerificationStatus } from '../common/enums/identity-verification-status.enum';

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true, type: 'varchar', unique: true, default: null })
  phoneNumber: string | null;

  @Column({ nullable: true, unique: true })
  nationalId: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.FARMER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ nullable: true, type: 'varchar', default: null })
  profileImage: string | null;

  @Column({ default: 1 })
  onboardingStep: number;

  @Column({ default: false })
  onboardingCompleted: boolean;

  @Column({ nullable: true })
  documentType: string;

  @Column({ nullable: true })
  idImageUrl: string;

  @Column({
    type: 'enum',
    enum: IdentityVerificationStatus,
    nullable: true,
  })
  identityVerificationStatus: IdentityVerificationStatus;

  @Column({ default: false })
  nationalIdVerified: boolean;

  @Column({ nullable: true, type: 'simple-array' })
  assignedRegions: string[];

  @Column({ nullable: true })
  activeFarmId: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  lastLoginAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  deletedAt: Date | null;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  provider: AuthProvider;

  @Column({ nullable: true })
  providerId: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ nullable: true })
  emailVerificationExpires: Date;

  @Column({ nullable: true })
  resetPasswordToken: string;

  @Column({ nullable: true })
  resetPasswordExpires: Date;

  @OneToMany(() => Farm, (farm) => farm.user)
  farms: Farm[];

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
