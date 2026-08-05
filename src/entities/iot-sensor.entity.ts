import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Farm } from './farm.entity';
import { User } from './user.entity';
import { SensorReading } from './sensor-reading.entity';

export enum IoTSensorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAULTY = 'faulty',
}

@Entity('iot_sensors')
export class IoTSensor {
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
  name: string;

  @Column({ unique: true })
  deviceId: string;

  @Column({ default: 'soil_moisture' })
  sensorType: string;

  @Column({ default: '%' })
  unit: string;

  @Column({
    type: 'enum',
    enum: IoTSensorStatus,
    default: IoTSensorStatus.ACTIVE,
  })
  status: IoTSensorStatus;

  @Column({ nullable: true })
  location: string | null;

  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
