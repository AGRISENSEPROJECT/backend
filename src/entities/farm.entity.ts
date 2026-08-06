import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum SoilType {
  CLAY = 'clay',
  SANDY = 'sandy',
  LOAMY = 'loamy',
  SILTY = 'silty',
  PEATY = 'peaty',
  CHALKY = 'chalky',
}

@Entity('farms')
export class Farm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  size: number;

  @Column({
    type: 'enum',
    enum: SoilType,
  })
  soilType: SoilType;

  @Column()
  country: string;

  @Column()
  province: string;

  @Column()
  district: string;

  @Column()
  sector: string;

  @Column()
  cell: string;

  @Column()
  village: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 7 })
  latitude: number | null;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 7 })
  longitude: number | null;

  @Column()
  ownerName: string;

  @Column({ nullable: true, type: 'varchar' })
  ownerPhone: string | null;

  @Column()
  ownerEmail: string;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl: string | null;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true, type: 'varchar' })
  irrigationMethod: string | null;

  @Column({ nullable: true, type: 'simple-array' })
  cropHistory: string[] | null;

  @Column({ nullable: true, type: 'text' })
  farmingPractices: string | null;

  @Column({ nullable: true, type: 'text' })
  soilInformation: string | null;

  @ManyToOne(() => User, (user) => user.farms, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true, type: 'timestamp' })
  archivedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
