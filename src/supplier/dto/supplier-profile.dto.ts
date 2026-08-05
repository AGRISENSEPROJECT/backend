import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierProfileDto {
  @ApiProperty({ example: 'Kigali Agro Supplies Ltd', minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  businessName: string;

  @ApiPropertyOptional({
    example: 'We supply fertilizers, seeds, and farm tools across Rwanda.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
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

  @ApiPropertyOptional({ example: 'Remera' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ example: 'Rukiri I' })
  @IsOptional()
  @IsString()
  cell?: string;

  @ApiPropertyOptional({ example: 'Amahoro' })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiPropertyOptional({ example: 'KN 5 Ave, Remera' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}

export class UpdateSupplierProfileDto extends PartialType(
  CreateSupplierProfileDto,
) {}

export class ListSuppliersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search by business name' })
  @IsOptional()
  @IsString()
  search?: string;
}
