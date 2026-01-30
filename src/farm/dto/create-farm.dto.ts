import { IsString, IsNumber, IsEnum, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SoilType } from '../../entities/farm.entity';

export class CreateFarmDto {
  @ApiProperty({
    description: 'Farm name',
    example: 'Green Valley Farm',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Farm size in acres',
    example: 25.5,
  })
  @IsNumber()
  size: number;

  @ApiProperty({
    description: 'Type of soil',
    example: 'loamy',
    enum: SoilType,
  })
  @IsEnum(SoilType)
  soilType: SoilType;

  @ApiProperty({
    description: 'Country where the farm is located',
    example: 'Rwanda',
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'District where the farm is located',
    example: 'Gasabo',
  })
  @IsString()
  district: string;

  @ApiProperty({
    description: 'Sector where the farm is located',
    example: 'Remera',
  })
  @IsString()
  sector: string;

  @ApiProperty({
    description: 'Cell where the farm is located',
    example: 'Rukiri I',
  })
  @IsString()
  cell: string;

  @ApiProperty({
    description: 'Village where the farm is located',
    example: 'Amahoro',
  })
  @IsString()
  village: string;

  @ApiProperty({
    description: 'Farm owner full name',
    example: 'John Doe',
  })
  @IsString()
  ownerName: string;

  @ApiProperty({
    description: 'Farm owner phone number',
    example: '+254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiProperty({
    description: 'Farm owner email address',
    example: 'owner@example.com',
  })
  @IsEmail()
  ownerEmail: string;
}

export class UpdateFarmDto {
  @ApiProperty({
    description: 'Farm name',
    example: 'Green Valley Farm',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Farm size in acres',
    example: 25.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiProperty({
    description: 'Type of soil',
    example: 'loamy',
    enum: SoilType,
    required: false,
  })
  @IsOptional()
  @IsEnum(SoilType)
  soilType?: SoilType;

  @ApiProperty({
    description: 'Country where the farm is located',
    example: 'Rwanda',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'District where the farm is located',
    example: 'Gasabo',
    required: false,
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({
    description: 'Sector where the farm is located',
    example: 'Remera',
    required: false,
  })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({
    description: 'Cell where the farm is located',
    example: 'Rukiri I',
    required: false,
  })
  @IsOptional()
  @IsString()
  cell?: string;

  @ApiProperty({
    description: 'Village where the farm is located',
    example: 'Amahoro',
    required: false,
  })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiProperty({
    description: 'Farm owner full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiProperty({
    description: 'Farm owner phone number',
    example: '+254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiProperty({
    description: 'Farm owner email address',
    example: 'owner@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}
