import {
  Allow,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsUrl,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SoilScanSource } from '../../entities/soil-scan.entity';

const toOptionalObject = ({ value }: { value: unknown }) => {
  if (value === '' || value == null) {
    return undefined;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : value;
    } catch {
      return value;
    }
  }
  return value;
};

export class CreatePredictionDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Soil image file sent to the model API',
  })
  @Allow()
  image: unknown;

  @ApiProperty({ description: 'Farm ID for this prediction run' })
  @IsUUID()
  farmId: string;

  @ApiPropertyOptional({ enum: SoilScanSource, default: SoilScanSource.MANUAL })
  @IsOptional()
  @IsEnum(SoilScanSource)
  source?: SoilScanSource;

  @ApiPropertyOptional({ description: 'Original soil image URL if source is image' })
  @Transform(({ value }) => {
    if (value == null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return value;
    }
    const normalized = value.trim();
    return normalized === '' || normalized.toLowerCase() === 'null'
      ? undefined
      : normalized;
  })
  @IsOptional()
  @IsUrl()
  rawImageUrl?: string;

  @ApiProperty({ description: 'Current temperature in Celsius' })
  @Type(() => Number)
  @IsNumber()
  temperature: number;

  @ApiProperty({ description: 'Current humidity percentage' })
  @Type(() => Number)
  @IsNumber()
  humidity: number;

  @ApiProperty({ description: 'Current rainfall in mm' })
  @Type(() => Number)
  @IsNumber()
  rainfall: number;

  @ApiProperty({ description: 'Target crop type', example: 'Tomatoes' })
  @IsString()
  @IsNotEmpty()
  crop_type: string;

  @ApiProperty({ description: 'Nitrogen content (mg/kg)' })
  @Type(() => Number)
  @IsNumber()
  nitrogen: number;

  @ApiProperty({ description: 'Phosphorus content (mg/kg)' })
  @Type(() => Number)
  @IsNumber()
  phosphorus: number;

  @ApiProperty({ description: 'Potassium content (mg/kg)' })
  @Type(() => Number)
  @IsNumber()
  potassium: number;

  @ApiPropertyOptional({ description: 'Soil type' })
  @IsOptional()
  @IsString()
  soilType?: string;

  @ApiPropertyOptional({ description: 'Soil pH level' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  phLevel?: number;

  @ApiPropertyOptional({ description: 'Organic matter levels percentage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  organicLevels?: number;

  @ApiPropertyOptional({ description: 'Soil color' })
  @IsOptional()
  @IsString()
  soilColor?: string;

  @ApiPropertyOptional({ description: 'Soil structure' })
  @IsOptional()
  @IsString()
  soilStructure?: string;

  @ApiPropertyOptional({ description: 'Property rates map (e.g. moisture: moderate)' })
  @Transform(toOptionalObject)
  @IsOptional()
  @IsObject()
  propertyRates?: Record<string, string>;

  @ApiPropertyOptional({ description: 'NPK rates map (e.g. nitrogen: low)' })
  @Transform(toOptionalObject)
  @IsOptional()
  @IsObject()
  npkRates?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Optional model name override', default: 'agrisense-model' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  modelName?: string;

  @ApiPropertyOptional({ description: 'Optional model version tag' })
  @IsOptional()
  @IsString()
  modelVersion?: string;

  @ApiPropertyOptional({ description: 'Additional metadata sent to model and stored in DB' })
  @Transform(toOptionalObject)
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
