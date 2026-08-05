import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../entities/payment.entity';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

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
}

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'Flutterwave transaction_id from redirect/callback',
    example: '1234567',
  })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({
    description: 'Optional tx_ref for extra validation',
    example: 'AGS-pay-uuid',
  })
  @IsOptional()
  @IsString()
  txRef?: string;
}

export class FailPaymentDto {
  @ApiPropertyOptional({ example: 'Customer cancelled checkout' })
  @IsOptional()
  @IsString()
  reason?: string;
}
