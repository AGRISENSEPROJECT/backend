import { IsString, IsNumber, IsEnum, IsEmail, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SoilType } from '../../entities/farm.entity';

export class CreateFarmDto {
  @ApiProperty({ example: 'Green Valley Farm' })
  @IsString()
  name: string;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  size: number;

  @ApiProperty({ example: 'loamy', enum: SoilType })
  @IsEnum(SoilType)
  soilType: SoilType;

  @ApiProperty({ example: 'Rwanda' })
  @IsString()
  country: string;

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

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  ownerName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  ownerEmail: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  irrigationMethod?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cropHistory?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmingPractices?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  soilInformation?: string;
}

export class UpdateFarmDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiProperty({ required: false, enum: SoilType })
  @IsOptional()
  @IsEnum(SoilType)
  soilType?: SoilType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  irrigationMethod?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cropHistory?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmingPractices?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  soilInformation?: string;
}
