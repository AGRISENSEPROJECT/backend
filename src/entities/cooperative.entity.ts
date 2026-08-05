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
import { User } from './user.entity';
import { CooperativeMember } from './cooperative-member.entity';

@Entity('cooperatives')
export class Cooperative {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  province: string | null;

  @Column({ nullable: true })
  district: string | null;

  @Column({ type: 'uuid', nullable: true })
  chairUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'chairUserId' })
  chair: User | null;

  @OneToMany(() => CooperativeMember, (member) => member.cooperative)
  members: CooperativeMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
