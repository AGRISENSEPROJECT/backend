import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizationType } from '../../entities/organization.entity';

export class AssignedRegionDto {
  @ApiPropertyOptional({ example: 'Eastern Province' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Kayonza' })
  @IsOptional()
  @IsString()
  district?: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Rwanda Agri Support Initiative' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Supporting smallholder farmers with training.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '+250788000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Rwanda' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Kigali City' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Gasabo' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    type: [AssignedRegionDto],
    description: 'NGO regional scope (ignored for government unless provided)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignedRegionDto)
  assignedRegions?: AssignedRegionDto[];
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
}
