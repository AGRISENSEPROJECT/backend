import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Farm } from '../entities/farm.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { Recommendation } from '../entities/recommendation.entity';
import { SoilScan } from '../entities/soil-scan.entity';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';
import { SupplierModule } from '../supplier/supplier.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Farm, SoilScan, PredictionRun, Recommendation]),
    forwardRef(() => SupplierModule),
  ],
  controllers: [PredictionController],
  providers: [PredictionService],
})
export class PredictionModule {}
