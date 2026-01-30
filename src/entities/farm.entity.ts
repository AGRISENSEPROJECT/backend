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
  district: string;

  @Column()
  sector: string;

  @Column()
  cell: string;

  @Column()
  village: string;

  @Column()
  ownerName: string;

  @Column({ nullable: true })
  ownerPhone: string;

  @Column()
  ownerEmail: string;

  @ManyToOne(() => User, (user) => user.farms, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}