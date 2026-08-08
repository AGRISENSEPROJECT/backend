import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import {
  CancelSubscriptionDto,
  CheckoutDto,
  EnterpriseInquiryDto,
} from './dto/billing.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  private userId(req: Request) {
    return (req.user as { id: string }).id;
  }

  @Get('plans')
  @ApiOperation({
    summary: 'List public subscription plans',
    description:
      'Returns Starter, Pro, and Enterprise catalog with RWF prices, features, and limits for the frontend subscription page.',
  })
  listPlans() {
    return this.billingService.listPublicPlans();
  }

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user subscription',
    description:
      'Returns plan, status, billing cycle, period dates, payment label, cancel flag, and entitlement limits.',
  })
  getSubscription(@Req() req: Request) {
    return this.billingService.getCurrentSubscription(this.userId(req));
  }

  @Post('subscription/starter')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Activate free Starter plan',
    description:
      'Idempotent. Cancels any pending Pro checkout and confirms Starter as the current plan.',
  })
  activateStarter(@Req() req: Request) {
    return this.billingService.activateStarter(this.userId(req));
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ medium: { limit: 8, ttl: 60000 } })
  @ApiOperation({
    summary: 'Start Pro checkout',
    description:
      'Creates a pending Pro subscription and initiates Flutterwave payment (MoMo, Airtel Money, or card). Pro becomes active only after a verified webhook/callback.',
  })
  checkout(@Req() req: Request, @Body() dto: CheckoutDto) {
    return this.billingService.checkout(this.userId(req), dto);
  }

  @Get('checkout/:checkoutId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Poll checkout status',
    description: 'Poll until successful, failed, canceled, or still pending_payment.',
  })
  getCheckout(@Req() req: Request, @Param('checkoutId') checkoutId: string) {
    return this.billingService.getCheckoutStatus(this.userId(req), checkoutId);
  }

  @Post('subscription/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancel paid subscription',
    description:
      'Default atPeriodEnd=true: keep Pro until currentPeriodEnd, then auto-downgrade to Starter. Set atPeriodEnd=false for immediate Starter.',
  })
  cancel(@Req() req: Request, @Body() dto: CancelSubscriptionDto) {
    return this.billingService.cancelSubscription(this.userId(req), dto);
  }

  @Post('subscription/resume')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Resume subscription',
    description: 'Undo cancel-at-period-end while still in the paid period.',
  })
  resume(@Req() req: Request) {
    return this.billingService.resumeSubscription(this.userId(req));
  }

  @Post('enterprise/inquiry')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Submit Enterprise sales inquiry',
    description:
      'Creates an enterprise lead and emails agrisense8@gmail.com (or BILLING_SALES_EMAIL). No self-serve checkout.',
  })
  enterpriseInquiry(@Req() req: Request, @Body() dto: EnterpriseInquiryDto) {
    return this.billingService.createEnterpriseInquiry(this.userId(req), dto);
  }
}
