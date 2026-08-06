import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdvisoryType } from '../../entities/government-advisory.entity';

export class CreateAdvisoryDto {
  @ApiProperty({ example: 'Heavy Rainfall Alert' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Farmers should prepare for heavy rains...' })
  @IsString()
  content: string;

  @ApiProperty({ enum: AdvisoryType, example: AdvisoryType.WEATHER })
  @IsEnum(AdvisoryType)
  type: AdvisoryType;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRegions?: string[];
}

export class UpdateAdvisoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
