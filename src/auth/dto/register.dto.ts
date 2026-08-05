import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../entities/user.entity';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Username (minimum 3 characters)',
    example: 'johndoe',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    description: 'Password (minimum 6 characters)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description:
      'Account role. Admin cannot self-register. Defaults to farmer. NGO/Government/Supplier require admin approval after OTP.',
    enum: [
      UserRole.FARMER,
      UserRole.SUPPLIER,
      UserRole.NGO,
      UserRole.GOVERNMENT,
    ],
    example: UserRole.FARMER,
    default: UserRole.FARMER,
  })
  @IsOptional()
  @IsIn(
    [UserRole.FARMER, UserRole.SUPPLIER, UserRole.NGO, UserRole.GOVERNMENT],
    {
      message: 'role must be farmer, supplier, ngo, or government',
    },
  )
  role?:
    | UserRole.FARMER
    | UserRole.SUPPLIER
    | UserRole.NGO
    | UserRole.GOVERNMENT;
}

export class SocialRegisterDto {
  @ApiProperty({
    description: 'User email from social provider',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Username from social provider',
    example: 'johndoe',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Social provider name',
    example: 'google',
    enum: ['google', 'facebook'],
  })
  @IsString()
  provider: string;

  @ApiProperty({
    description: 'Provider user ID',
    example: '1234567890',
  })
  @IsString()
  providerId: string;

  @ApiProperty({
    description: 'First name from social provider',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Last name from social provider',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;
}