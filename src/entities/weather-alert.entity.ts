import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Farm } from './farm.entity';

export enum WeatherAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('weather_alerts')
export class WeatherAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  province: string | null;

  @Column({ nullable: true })
  district: string | null;

  @Column({ type: 'uuid', nullable: true })
  farmId: string | null;

  @ManyToOne(() => Farm, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'farmId' })
  farm: Farm | null;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: WeatherAlertSeverity,
    default: WeatherAlertSeverity.INFO,
  })
  severity: WeatherAlertSeverity;

  @Column({ default: 'openweather' })
  source: string;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
