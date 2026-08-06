import {
  IsEmail,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaitlistRoleInterest } from '../../entities/waitlist-entry.entity';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'Jean Uwimana' })
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'jean@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid phone number format. Use E.164 like +250788123456',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    enum: WaitlistRoleInterest,
    example: WaitlistRoleInterest.FARMER,
  })
  @IsOptional()
  @IsEnum(WaitlistRoleInterest)
  interest?: WaitlistRoleInterest;

  @ApiPropertyOptional({ example: 'Green Valley Coop' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organization?: string;

  @ApiPropertyOptional({ example: 'Eastern Province' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @ApiPropertyOptional({ example: 'I want early access for my farms.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ example: 'landing-page' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
