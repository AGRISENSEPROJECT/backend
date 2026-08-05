import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YieldForecast } from '../entities/yield-forecast.entity';
import { Farm } from '../entities/farm.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { YieldController } from './yield.controller';
import { YieldService } from './yield.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([YieldForecast, Farm]),
    AuthModule,
    AuditModule,
  ],
  controllers: [YieldController],
  providers: [YieldService],
  exports: [YieldService],
})
export class YieldModule {}
