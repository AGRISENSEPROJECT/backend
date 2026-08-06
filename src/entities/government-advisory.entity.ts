import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

export enum AdvisoryType {
  GENERAL = 'GENERAL',
  WEATHER = 'WEATHER',
  DISEASE = 'DISEASE',
  EMERGENCY = 'EMERGENCY',
  FOOD_SECURITY = 'FOOD_SECURITY',
}

@Entity('government_advisories')
export class GovernmentAdvisory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  author: User;

  @Column()
  authorId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: AdvisoryType, default: AdvisoryType.GENERAL })
  type: AdvisoryType;

  @Column({ nullable: true, type: 'simple-array' })
  targetRegions: string[];

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
