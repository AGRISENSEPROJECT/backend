import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class CreateUserDto {
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

  @ApiProperty({ enum: UserRole, example: UserRole.SUPPLIER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedRegions?: string[];
}

export class CreateSupplierAccountDto {
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

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional({ type: [String], example: ['Kigali City', 'Eastern Province'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceRegions?: string[];

  @ApiPropertyOptional({
    description: 'If true, supplier is immediately approved and active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}

export class CreateNgoAccountDto {
  @ApiProperty({ example: 'ngo@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password1!' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Mukamana' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'Green Future Rwanda' })
  @IsString()
  organizationName: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ type: [String], example: ['Eastern Province', 'Southern Province'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedRegions?: string[];

  @ApiPropertyOptional({ type: [String], example: ['food-security', 'training'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @ApiPropertyOptional({
    description: 'If true, NGO is immediately approved and active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}

export class UpdateUserStatusDto {
  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'SUSPENDED', 'BANNED'] })
  @IsString()
  status: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class AssignRegionsDto {
  @ApiProperty({ type: [String], example: ['Kigali City', 'Northern Province'] })
  @IsArray()
  @IsString({ each: true })
  regions: string[];
}

export class ApprovalDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BroadcastDto {
  @ApiProperty({ example: 'Platform Maintenance' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Scheduled maintenance on Sunday' })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Optional role filter for announcement recipients',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class AdminResetPasswordDto {
  @ApiProperty({ example: 'Password1!' })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}

export class ModeratePostDto {
  @ApiProperty({ enum: ['hide', 'unhide', 'delete'], example: 'hide' })
  @IsString()
  action: 'hide' | 'unhide' | 'delete';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
