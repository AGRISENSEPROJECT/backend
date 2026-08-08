import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BillingService } from './billing.service';
import {
  AdminAssignSubscriptionDto,
  AdminRevokeSubscriptionDto,
} from './dto/billing.dto';
import { PlanId, SubscriptionStatus } from './billing.enums';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBillingController {
  constructor(private readonly billingService: BillingService) {}

  private actorId(req: Request) {
    return (req.user as { id: string })?.id;
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List current user subscriptions (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'planId', required: false, enum: PlanId })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  listSubscriptions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('planId') planId?: string,
    @Query('status') status?: string,
  ) {
    return this.billingService.adminListSubscriptions(
      Number(page) || 1,
      Number(limit) || 20,
      planId,
      status,
    );
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List payment transactions (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  listTransactions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.billingService.adminListTransactions(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Post('subscriptions/:userId/assign')
  @ApiOperation({
    summary: 'Manually assign a plan',
    description: 'Admin grant for Enterprise/Pro/comp. Audited.',
  })
  assign(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() dto: AdminAssignSubscriptionDto,
  ) {
    return this.billingService.adminAssign(userId, dto, this.actorId(req));
  }

  @Post('subscriptions/:userId/revoke')
  @ApiOperation({
    summary: 'Revoke paid plan back to Starter',
    description: 'Force user onto free Starter. Audited.',
  })
  revoke(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() dto: AdminRevokeSubscriptionDto,
  ) {
    return this.billingService.adminRevoke(userId, dto, this.actorId(req));
  }
}
