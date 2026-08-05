import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherAlert } from '../entities/weather-alert.entity';
import { Farm } from '../entities/farm.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherAlert, Farm]),
    AuthModule,
    forwardRef(() => NotificationModule),
    AuditModule,
  ],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
