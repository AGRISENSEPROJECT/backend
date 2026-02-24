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

export enum SoilScanSource {
  MANUAL = 'manual',
  IMAGE = 'image',
}

@Entity('soil_scans')
export class SoilScan {
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

  @Column({
    type: 'enum',
    enum: SoilScanSource,
    default: SoilScanSource.MANUAL,
  })
  source: SoilScanSource;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  moisture: number | null;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  temperature: number | null;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  phLevel: number | null;

  @Column({ type: 'varchar', nullable: true })
  soilType: string | null;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  organicLevels: number | null;

  @Column({ type: 'varchar', nullable: true })
  soilColor: string | null;

  @Column({ type: 'varchar', nullable: true })
  soilStructure: string | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  nitrogen: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  phosphorus: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  potassium: number | null;

  @Column({ type: 'jsonb', nullable: true })
  propertyRates: Record<string, string> | null;

  @Column({ type: 'jsonb', nullable: true })
  npkRates: Record<string, string> | null;

  @Column({ type: 'varchar', nullable: true })
  rawImageUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawInput: Record<string, unknown> | null;

  @CreateDateColumn()
  scannedAt: Date;
}
