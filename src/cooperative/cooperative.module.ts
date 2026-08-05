import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cooperative } from '../entities/cooperative.entity';
import { CooperativeMember } from '../entities/cooperative-member.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CooperativeController } from './cooperative.controller';
import { CooperativeService } from './cooperative.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cooperative, CooperativeMember, User]),
    AuthModule,
    AuditModule,
  ],
  controllers: [CooperativeController],
  providers: [CooperativeService],
  exports: [CooperativeService],
})
export class CooperativeModule {}
