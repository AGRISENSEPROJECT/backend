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
}

export class UpdateFarmLocationDto {
  @ApiProperty({
    description: 'Country where the farm is located',
    example: 'Kenya',
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'District where the farm is located',
    example: 'Nakuru',
  })
  @IsString()
  district: string;

  @ApiProperty({
    description: 'Farm latitude coordinates',
    example: -0.3031,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    description: 'Farm longitude coordinates',
    example: 36.0800,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateFarmOwnerDto {
  @ApiProperty({
    description: 'Farm owner full name',
    example: 'John Doe',
  })
  @IsString()
  ownerName: string;

  @ApiProperty({
    description: 'Farm owner phone number',
    example: '+254712345678',
  })
  @IsString()
  ownerPhone: string;

  @ApiProperty({
    description: 'Farm owner email address',
    example: 'owner@example.com',
  })
  @IsEmail()
  ownerEmail: string;
}