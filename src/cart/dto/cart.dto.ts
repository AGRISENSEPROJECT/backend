import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../entities/payment.entity';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutCartDto {
  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH_ON_DELIVERY,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'Remera, Gasabo, Kigali' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  deliveryAddress?: string;

  @ApiPropertyOptional({ example: 'Call on arrival' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
