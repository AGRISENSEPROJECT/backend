import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, PaymentMethodType, PlanId } from '../billing.enums';

export class CheckoutDto {
  @ApiProperty({ enum: [PlanId.PRO], example: PlanId.PRO })
  @IsEnum(PlanId)
  planId: PlanId;

  @ApiProperty({ enum: BillingCycle, example: BillingCycle.MONTHLY })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiProperty({
    enum: [PaymentMethodType.MOMO, PaymentMethodType.AIRTEL, PaymentMethodType.CARD],
    example: PaymentMethodType.MOMO,
  })
  @IsEnum(PaymentMethodType)
  method: PaymentMethodType;

  @ApiPropertyOptional({
    example: '+250788123456',
    description: 'Required for momo/airtel',
  })
  @ValidateIf((o) => o.method === PaymentMethodType.MOMO || o.method === PaymentMethodType.AIRTEL)
  @IsString()
  @Matches(/^\+?2507\d{8}$|^\+?07\d{8}$/, {
    message: 'Phone must be a valid Rwanda mobile number',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'https://agrisense.rw/app/subscription?paid=1' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'https://agrisense.rw/app/subscription?canceled=1' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'If true (default), Pro remains active until currentPeriodEnd, then downgrades to Starter. If false, downgrade immediately.',
  })
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean = true;
}

export class EnterpriseInquiryDto {
  @ApiProperty({ example: 'Green Future Rwanda' })
  @IsString()
  @MaxLength(160)
  organizationName: string;

  @ApiProperty({ example: 'Jean Bosco' })
  @IsString()
  @MaxLength(160)
  contactName: string;

  @ApiProperty({ example: 'partnerships@example.com' })
  @IsEmail()
  contactEmail: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ example: 'We need org-wide licenses for 200 farms.' })
  @IsString()
  @MaxLength(4000)
  message: string;
}

export class AdminAssignSubscriptionDto {
  @ApiProperty({ enum: PlanId, example: PlanId.ENTERPRISE })
  @IsEnum(PlanId)
  planId: PlanId;

  @ApiPropertyOptional({
    example: 365,
    description: 'Paid period length in days. Defaults: Pro 30/365 by cycle, Enterprise 365.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  periodDays?: number;

  @ApiPropertyOptional({ example: 'Comp plan for pilot NGO' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}

export class AdminRevokeSubscriptionDto {
  @ApiPropertyOptional({ example: 'Contract ended' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
