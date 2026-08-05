import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeatherAlertSeverity } from '../../entities/weather-alert.entity';

export class CreateWeatherAlertDto {
  @ApiProperty({ example: 'Heavy rainfall expected' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Expect 80mm rainfall over 24 hours in your area.' })
  @IsString()
  @MinLength(3)
  message: string;

  @ApiPropertyOptional({ enum: WeatherAlertSeverity, default: WeatherAlertSeverity.WARNING })
  @IsOptional()
  @IsEnum(WeatherAlertSeverity)
  severity?: WeatherAlertSeverity;

  @ApiPropertyOptional({ example: 'Kigali' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Gasabo' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}

export class ListWeatherAlertsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
