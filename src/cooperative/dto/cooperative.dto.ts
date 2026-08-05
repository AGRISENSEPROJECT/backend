import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CooperativeMemberRole } from '../../entities/cooperative-member.entity';

export class CreateCooperativeDto {
  @ApiProperty({ example: 'Gasabo Farmers Cooperative' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Kigali' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Gasabo' })
  @IsOptional()
  @IsString()
  district?: string;
}

export class AddMemberDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    enum: CooperativeMemberRole,
    default: CooperativeMemberRole.MEMBER,
  })
  @IsOptional()
  @IsEnum(CooperativeMemberRole)
  role?: CooperativeMemberRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: CooperativeMemberRole })
  @IsEnum(CooperativeMemberRole)
  role: CooperativeMemberRole;
}
