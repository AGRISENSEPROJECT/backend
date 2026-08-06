import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NgoController, GovernmentController } from './regional.controller';
import { RegionalService } from './regional.service';
import { Farm } from '../entities/farm.entity';
import { User } from '../entities/user.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { NgoOrganization } from '../entities/ngo-organization.entity';
import { AgriculturalProgram } from '../entities/agricultural-program.entity';
import { GovernmentAdvisory } from '../entities/government-advisory.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Farm, User, PredictionRun, NgoOrganization,
      AgriculturalProgram, GovernmentAdvisory,
    ]),
    NotificationModule,
  ],
  controllers: [NgoController, GovernmentController],
  providers: [RegionalService],
})
export class RegionalModule {}
