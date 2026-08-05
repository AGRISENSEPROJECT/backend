import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Cooperative } from './cooperative.entity';
import { User } from './user.entity';

export enum CooperativeMemberRole {
  MEMBER = 'member',
  OFFICER = 'officer',
  CHAIR = 'chair',
}

@Entity('cooperative_members')
@Unique(['cooperativeId', 'userId'])
export class CooperativeMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cooperativeId: string;

  @ManyToOne(() => Cooperative, (coop) => coop.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cooperativeId' })
  cooperative: Cooperative;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: CooperativeMemberRole,
    default: CooperativeMemberRole.MEMBER,
  })
  role: CooperativeMemberRole;

  @CreateDateColumn({ name: 'joinedAt' })
  joinedAt: Date;
}
