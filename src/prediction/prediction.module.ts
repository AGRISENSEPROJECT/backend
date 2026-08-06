import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Farm } from '../entities/farm.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { Recommendation } from '../entities/recommendation.entity';
import { SoilScan } from '../entities/soil-scan.entity';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';

@Module({
  imports: [TypeOrmModule.forFeature([Farm, SoilScan, PredictionRun, Recommendation])],
  controllers: [PredictionController],
  providers: [PredictionService],
})
export class PredictionModule {}
