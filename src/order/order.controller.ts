import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Post()
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Place an order (all items must be from the same supplier)',
  })
  @ApiResponse({ status: 201, description: 'Order created' })
  create(@Req() req: Request, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(this.getActor(req), dto);
  }

  @Get('me')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List my orders as a buyer' })
  getMine(@Req() req: Request, @Query() query: ListOrdersQueryDto) {
    return this.orderService.getMyOrders(this.getActor(req), query);
  }

  @Get('supplier')
  @Roles(UserRole.SUPPLIER)
  @ApiOperation({ summary: 'List incoming orders for my supplier account' })
  getSupplierOrders(@Req() req: Request, @Query() query: ListOrdersQueryDto) {
    return this.orderService.getSupplierOrders(this.getActor(req), query);
  }

  @Get(':id')
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get order details' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  getOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.getOrder(this.getActor(req), id);
  }

  @Patch(':id/status')
  @Roles(UserRole.FARMER, UserRole.SUPPLIER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Update order status (buyer can cancel pending; supplier manages fulfillment)',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  updateStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(this.getActor(req), id, dto);
  }
}
