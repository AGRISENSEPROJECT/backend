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
  SEED = 'seed',
  FERTILIZER = 'fertilizer',
  PESTICIDE = 'pesticide',
  HERBICIDE = 'herbicide',
  IRRIGATION = 'irrigation',
  EQUIPMENT = 'equipment',
  SOIL_IMPROVEMENT = 'soil_improvement',
  DISEASE = 'disease',
  WEATHER = 'weather',
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

  @Column({ nullable: true, type: 'varchar' })
  cropType: string | null;

  @Column({ nullable: true, type: 'varchar' })
  growingSeason: string | null;

  @Column({ nullable: true, type: 'varchar' })
  soilType: string | null;

  @Column({ nullable: true, type: 'jsonb' })
  weatherConditions: Record<string, unknown> | null;

  @Column({ nullable: true, type: 'varchar' })
  diseasePrediction: string | null;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 4 })
  confidenceScore: number | null;

  @Column({ nullable: true, type: 'varchar' })
  aiModelVersion: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
