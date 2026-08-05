import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Program } from './program.entity';
import { User } from './user.entity';

@Entity('program_farmers')
@Unique(['programId', 'farmerId'])
export class ProgramFarmer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  programId: string;

  @ManyToOne(() => Program, (program) => program.programFarmers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'programId' })
  program: Program;

  @Column()
  farmerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farmerId' })
  farmer: User;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  assignedAt: Date;
}
