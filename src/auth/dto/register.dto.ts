import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from '../../common/validators/password.validator';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
};

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password1!', description: 'Min 8 chars, upper, lower, number, special' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({
    example: 'John',
    description: 'Preferred. Legacy clients may send `username` instead.',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  lastName?: string;

  /** Legacy mobile field — mapped to firstName when firstName is omitted */
  @ApiPropertyOptional({ example: 'john_doe', deprecated: true })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(2)
  username?: string;

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

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  username?: string;
}
