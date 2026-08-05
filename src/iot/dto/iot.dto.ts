import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IoTSensorStatus } from '../../entities/iot-sensor.entity';

export class RegisterSensorDto {
  @ApiProperty()
  @IsUUID()
  farmId: string;

  @ApiProperty({ example: 'Field A Moisture Sensor' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'SN-MOIST-001' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  deviceId: string;

  @ApiPropertyOptional({ example: 'soil_moisture', default: 'soil_moisture' })
  @IsOptional()
  @IsString()
  sensorType?: string;

  @ApiPropertyOptional({ example: '%', default: '%' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 'Plot 3 near irrigation line' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class IngestReadingDto {
  @ApiProperty({ example: 'SN-MOIST-001' })
  @IsString()
  deviceId: string;

  @ApiProperty({ example: 28.5 })
  @Type(() => Number)
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ example: '%' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateSensorStatusDto {
  @ApiProperty({ enum: IoTSensorStatus })
  @IsEnum(IoTSensorStatus)
  status: IoTSensorStatus;
}

export class ListReadingsQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
