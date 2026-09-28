import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinanceAccountType,
  FinanceCategoryKind,
  FinanceTransactionStatus,
  FinanceTransactionType,
} from '../finance.enums';

export class CreateFinanceAccountDto {
  @ApiProperty({ example: 'Bank of Kigali' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: FinanceAccountType, example: FinanceAccountType.BANK })
  @IsEnum(FinanceAccountType)
  type: FinanceAccountType;

  @ApiPropertyOptional({ example: 'Bank of Kigali' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  institution?: string;

  @ApiPropertyOptional({ example: '4001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateFinanceAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: FinanceAccountType })
  @IsOptional()
  @IsEnum(FinanceAccountType)
  type?: FinanceAccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFinanceCategoryDto {
  @ApiProperty({ example: 'Subscriptions' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: FinanceCategoryKind, example: FinanceCategoryKind.INCOME })
  @IsEnum(FinanceCategoryKind)
  kind: FinanceCategoryKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#0B6E4F' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;
}

export class UpdateFinanceCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: FinanceCategoryKind })
  @IsOptional()
  @IsEnum(FinanceCategoryKind)
  kind?: FinanceCategoryKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFinanceTransactionDto {
  @ApiProperty({ enum: FinanceTransactionType, example: FinanceTransactionType.EXPENSE })
  @IsEnum(FinanceTransactionType)
  type: FinanceTransactionType;

  @ApiProperty({ example: 150000, description: 'Amount in whole RWF' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ example: '2026-09-28' })
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ example: 'Office internet — September' })
  @IsString()
  @MaxLength(240)
  description: string;

  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ example: 'MTN Rwanda' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterparty?: string;

  @ApiPropertyOptional({ example: 'INV-2044' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    enum: FinanceTransactionStatus,
    description: 'Defaults to APPROVED for income and PENDING for expenses',
  })
  @IsOptional()
  @IsEnum(FinanceTransactionStatus)
  status?: FinanceTransactionStatus;
}

export class UpdateFinanceTransactionDto {
  @ApiPropertyOptional({ enum: FinanceTransactionType })
  @IsOptional()
  @IsEnum(FinanceTransactionType)
  type?: FinanceTransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterparty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class FinanceDecisionDto {
  @ApiPropertyOptional({ example: 'Duplicate invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
