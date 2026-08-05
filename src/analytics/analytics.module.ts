import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { Order } from '../entities/order.entity';
import { Program } from '../entities/program.entity';
import { Organization } from '../entities/organization.entity';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Farm,
      PredictionRun,
      Order,
      Program,
      Organization,
    ]),
    AuthModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
