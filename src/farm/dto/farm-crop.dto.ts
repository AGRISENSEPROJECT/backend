import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CropStatus } from '../../entities/farm-crop.entity';

export class CreateFarmCropDto {
  @ApiProperty({ example: 'Maize' })
  @IsString()
  cropType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  variety?: string;

  @ApiProperty({ required: false, example: 'Season A' })
  @IsOptional()
  @IsString()
  plantingSeason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  plantingDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedHarvestDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  harvestSeason?: string;

  @ApiProperty({ required: false, enum: CropStatus })
  @IsOptional()
  @IsEnum(CropStatus)
  status?: CropStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  estimatedYield?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  areaPlanted?: number;
}

export class UpdateFarmCropDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cropType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  variety?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  plantingSeason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  plantingDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedHarvestDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  harvestSeason?: string;

  @ApiProperty({ required: false, enum: CropStatus })
  @IsOptional()
  @IsEnum(CropStatus)
  status?: CropStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  estimatedYield?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  areaPlanted?: number;
}
