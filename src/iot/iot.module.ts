import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IoTSensor } from '../entities/iot-sensor.entity';
import { SensorReading } from '../entities/sensor-reading.entity';
import { Farm } from '../entities/farm.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IoTSensor, SensorReading, Farm]),
    AuthModule,
    forwardRef(() => NotificationModule),
    AuditModule,
  ],
  controllers: [IoTController],
  providers: [IoTService],
  exports: [IoTService],
})
export class IoTModule {}
