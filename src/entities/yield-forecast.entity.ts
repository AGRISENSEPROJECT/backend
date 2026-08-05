import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Farm } from './farm.entity';
import { User } from './user.entity';

export enum YieldForecastStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('yield_forecasts')
export class YieldForecast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  farmId: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farmId' })
  farm: Farm;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  cropType: string;

  @Column('decimal', { precision: 14, scale: 4 })
  predictedYieldTons: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  confidence: number | null;

  @Column({ default: 'baseline_v1' })
  method: string;

  @Column({ type: 'jsonb', nullable: true })
  inputs: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: YieldForecastStatus,
    default: YieldForecastStatus.DRAFT,
  })
  status: YieldForecastStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
