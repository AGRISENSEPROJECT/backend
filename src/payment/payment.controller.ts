import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { PaymentService } from './payment.service';
import {
  FailPaymentDto,
  ListPaymentsQueryDto,
  VerifyPaymentDto,
} from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  // -------- Public provider endpoints (no JWT) --------

  @Post('webhook')
  @ApiOperation({
    summary: 'Flutterwave webhook endpoint (configure in Flutterwave dashboard)',
  })
  @ApiHeader({
    name: 'verif-hash',
    required: false,
    description: 'Must match FLW_WEBHOOK_HASH',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.paymentService.handleProviderWebhook(headers, body);
  }

  // -------- Authenticated endpoints --------

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my payments' })
  listMine(@Req() req: Request, @Query() query: ListPaymentsQueryDto) {
    return this.paymentService.getMyPayments(this.getActor(req), query);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment for an order' })
  @ApiParam({ name: 'orderId' })
  getByOrder(
    @Req() req: Request,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentService.getByOrderId(this.getActor(req), orderId);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Verify Flutterwave payment after checkout redirect (uses transaction_id)',
  })
  verify(@Req() req: Request, @Body() dto: VerifyPaymentDto) {
    return this.paymentService.verifyProviderPayment(this.getActor(req), dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  getOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.getById(this.getActor(req), id);
  }

  @Post(':id/initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initialize Flutterwave checkout for a mobile_money payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns checkoutUrl to open in browser/webview',
  })
  initiate(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.initiateProviderCheckout(this.getActor(req), id);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Confirm COD payment (supplier). Mobile money must use initiate + verify/webhook.',
  })
  confirm(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.confirmPayment(this.getActor(req), id);
  }

  @Post(':id/fail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark mobile money payment as failed locally' })
  fail(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: FailPaymentDto,
  ) {
    return this.paymentService.markFailed(
      this.getActor(req),
      id,
      body?.reason,
    );
  }
}
