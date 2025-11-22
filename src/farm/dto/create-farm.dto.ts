import { IsString, IsNumber, IsEnum, IsEmail, IsOptional } from 'class-validator';
import { SoilType } from '../../entities/farm.entity';

export class CreateFarmDto {
  @IsString()
  name: string;

  @IsNumber()
  size: number;

  @IsEnum(SoilType)
  soilType: SoilType;
}

export class UpdateFarmLocationDto {
  @IsString()
  country: string;

  @IsString()
  district: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateFarmOwnerDto {
  @IsString()
  ownerName: string;

  @IsString()
  ownerPhone: string;

  @IsEmail()
  ownerEmail: string;
}