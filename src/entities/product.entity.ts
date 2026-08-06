import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

export enum ProductCategory {
  SEEDS = 'SEEDS',
  FERTILIZER = 'FERTILIZER',
  PESTICIDE = 'PESTICIDE',
  HERBICIDE = 'HERBICIDE',
  TOOLS = 'TOOLS',
  IRRIGATION = 'IRRIGATION',
  LIVESTOCK = 'LIVESTOCK',
  MACHINERY = 'MACHINERY',
  CHEMICALS = 'CHEMICALS',
  EQUIPMENT = 'EQUIPMENT',
  OTHER = 'OTHER',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('decimal', { precision: 12, scale: 2 })
  price: number;

  @Column({ nullable: true })
  unit: string;

  @Column({
    type: 'enum',
    enum: ProductCategory,
    default: ProductCategory.OTHER,
  })
  category: ProductCategory;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ nullable: true, type: 'simple-array' })
  suitableCrops: string[];

  @Column({ nullable: true, type: 'simple-array' })
  suitableSeasons: string[];

  @Column({ nullable: true, type: 'simple-array' })
  suitableSoilTypes: string[];

  @Column({ nullable: true, type: 'simple-array' })
  serviceRegions: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  supplier: User;

  @Column()
  supplierId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
