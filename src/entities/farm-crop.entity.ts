import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Farm } from './farm.entity';
import { User } from './user.entity';

export enum CropStatus {
  PLANNED = 'PLANNED',
  PLANTED = 'PLANTED',
  GROWING = 'GROWING',
  READY_FOR_HARVEST = 'READY_FOR_HARVEST',
  HARVESTED = 'HARVESTED',
}

@Entity('farm_crops')
export class FarmCrop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn()
  farm: Farm;

  @Column()
  farmId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column()
  cropType: string;

  @Column({ nullable: true, type: 'varchar' })
  variety: string | null;

  @Column({ nullable: true, type: 'varchar' })
  plantingSeason: string | null;

  @Column({ nullable: true, type: 'date' })
  plantingDate: Date | null;

  @Column({ nullable: true, type: 'date' })
  expectedHarvestDate: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  harvestSeason: string | null;

  @Column({
    type: 'enum',
    enum: CropStatus,
    default: CropStatus.PLANNED,
  })
  status: CropStatus;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  estimatedYield: number | null;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  areaPlanted: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
