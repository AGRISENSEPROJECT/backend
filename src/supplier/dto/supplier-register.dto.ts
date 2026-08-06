import { IsEmail, IsString, MinLength, IsOptional, IsArray, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class SupplierRegisterDto {
  @ApiProperty({ example: 'supplier@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password1!' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'AgriSupply Ltd' })
  @IsString()
  businessName: string;

  @ApiProperty({ example: 'Kigali City, Gasabo' })
  @IsString()
  businessLocation: string;

  @ApiProperty({ example: 'FERTILIZER' })
  @IsString()
  businessCategory: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceRegions?: string[];
}

export class UpdateSupplierProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceRegions?: string[];

  @ApiProperty({ required: false, example: { monday: '8:00-17:00', saturday: '9:00-13:00' } })
  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  deliveryCapability?: boolean;
}
