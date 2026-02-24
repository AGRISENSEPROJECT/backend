import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Farm } from './farm.entity';
import { SoilScan } from './soil-scan.entity';
import { Recommendation } from './recommendation.entity';

export enum PredictionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('prediction_runs')
export class PredictionRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @ManyToOne(() => SoilScan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  soilScan: SoilScan | null;

  @Column({ type: 'varchar', nullable: true })
  soilScanId: string | null;

  @Column({ default: 'agrisense-model' })
  modelName: string;

  @Column({ type: 'varchar', nullable: true })
  modelVersion: string | null;

  @Column({
    type: 'enum',
    enum: PredictionStatus,
    default: PredictionStatus.PENDING,
  })
  status: PredictionStatus;

  @Column({ type: 'jsonb', nullable: true })
  inputPayload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  predictionSummary: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @OneToMany(() => Recommendation, (recommendation) => recommendation.prediction)
  recommendations: Recommendation[];

  @CreateDateColumn()
  executedAt: Date;
}
