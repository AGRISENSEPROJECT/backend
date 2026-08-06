import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password1!', description: 'Min 8 chars, upper, lower, number, special' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+250788123456', required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class IdentityVerificationDto {
  @ApiProperty({ example: '1199880012345678', description: '16-digit Rwanda National ID' })
  @IsString()
  nationalId: string;

  @ApiProperty({ example: 'NATIONAL_ID' })
  @IsString()
  documentType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idImageUrl?: string;
}

export class SocialRegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'google' })
  @IsString()
  provider: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  providerId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;
}
