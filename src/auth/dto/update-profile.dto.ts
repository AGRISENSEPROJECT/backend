import {
  IsString,
  IsOptional,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from '../../common/validators/password.validator';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
};

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: '+250788123456',
    description: 'Phone number (optional — omit or leave blank to skip)',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid phone number format. Use E.164 like +250788123456',
  })
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123!',
    description: 'Current password',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword1!' })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
