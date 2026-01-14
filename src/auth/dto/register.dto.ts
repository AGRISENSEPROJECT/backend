import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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