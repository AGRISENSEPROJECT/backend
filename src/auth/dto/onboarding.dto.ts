import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SoilType } from '../../entities/farm.entity';

export class OnboardingFarmDto {
  @ApiProperty({ example: 'Green Valley Farm' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Kigali City' })
  @IsString()
  province: string;

  @ApiProperty({ example: 'Gasabo' })
  @IsString()
  district: string;

  @ApiProperty({ example: 'Remera' })
  @IsString()
  sector: string;

  @ApiProperty({ example: 'Rukiri I' })
  @IsString()
  cell: string;

  @ApiProperty({ example: 'Amahoro' })
  @IsString()
  village: string;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  size: number;

  @ApiProperty({ example: 'loamy', enum: SoilType })
  @IsEnum(SoilType)
  soilType: SoilType;

  @ApiProperty({ required: false, example: -1.9441 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false, example: 30.0619 })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
