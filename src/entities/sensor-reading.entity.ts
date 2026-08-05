import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IoTSensor } from './iot-sensor.entity';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sensorId: string;

  @ManyToOne(() => IoTSensor, (sensor) => sensor.readings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sensorId' })
  sensor: IoTSensor;

  @Column('decimal', { precision: 14, scale: 4 })
  value: number;

  @Column({ nullable: true })
  unit: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  recordedAt: Date;
}
