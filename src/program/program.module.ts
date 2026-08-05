import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Program } from '../entities/program.entity';
import { ProgramFarmer } from '../entities/program-farmer.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProgramController } from './program.controller';
import { ProgramService } from './program.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Program, ProgramFarmer, User]),
    AuthModule,
    OrganizationModule,
  ],
  controllers: [ProgramController],
  providers: [ProgramService],
  exports: [ProgramService],
})
export class ProgramModule {}
