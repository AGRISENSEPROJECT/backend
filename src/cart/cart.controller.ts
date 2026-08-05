import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { CartService } from './cart.service';
import {
  AddCartItemDto,
  CheckoutCartDto,
  UpdateCartItemDto,
} from './dto/cart.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FARMER, UserRole.ADMIN)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Get()
  @ApiOperation({ summary: 'Get my shopping cart' })
  getCart(@Req() req: Request) {
    return this.cartService.getCart(this.getActor(req));
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a product to cart' })
  @ApiResponse({ status: 201, description: 'Item added' })
  addItem(@Req() req: Request, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(this.getActor(req), dto);
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiParam({ name: 'id', description: 'Cart item ID' })
  updateItem(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(this.getActor(req), id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove an item from cart' })
  @ApiParam({ name: 'id', description: 'Cart item ID' })
  removeItem(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.cartService.removeItem(this.getActor(req), id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear my cart' })
  clear(@Req() req: Request) {
    return this.cartService.clearCart(this.getActor(req));
  }

  @Post('checkout')
  @ApiOperation({
    summary:
      'Checkout cart: creates one order (+ payment) per supplier, then clears cart',
  })
  checkout(@Req() req: Request, @Body() dto: CheckoutCartDto) {
    return this.cartService.checkout(this.getActor(req), dto);
  }
}
