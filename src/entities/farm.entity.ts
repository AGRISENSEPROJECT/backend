import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
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
  district: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column()
  ownerName: string;

  @Column()
  ownerPhone: string;

  @Column()
  ownerEmail: string;

  @OneToOne(() => User, (user) => user.farm)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}