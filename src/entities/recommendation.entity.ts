import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Farm } from './farm.entity';
import { PredictionRun } from './prediction-run.entity';

export enum RecommendationType {
  CROP = 'crop',
  FERTILIZER = 'fertilizer',
  IRRIGATION = 'irrigation',
  GENERAL = 'general',
}

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PredictionRun, (prediction) => prediction.recommendations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  prediction: PredictionRun;

  @Column()
  predictionId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn()
  farm: Farm;

  @Column()
  farmId: string;

  @Column({
    type: 'enum',
    enum: RecommendationType,
    default: RecommendationType.GENERAL,
  })
  type: RecommendationType;

  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ default: 0 })
  rank: number;

  @Column({ default: false })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
