import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { YieldForecastStatus } from '../../entities/yield-forecast.entity';

export class CreateYieldForecastDto {
  @ApiProperty()
  @IsUUID()
  farmId: string;

  @ApiProperty({ example: 'maize' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  cropType: string;

  @ApiPropertyOptional({
    description: 'Optional override; otherwise computed from farm size baseline',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  predictedYieldTons?: number;

  @ApiPropertyOptional({ example: 72.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  confidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  inputs?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateYieldForecastStatusDto {
  @ApiProperty({ enum: YieldForecastStatus })
  @IsEnum(YieldForecastStatus)
  status: YieldForecastStatus;
}
