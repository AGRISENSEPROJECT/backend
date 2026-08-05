import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from '../entities/cart-item.entity';
import { Product } from '../entities/product.entity';
import {
  SupplierVerificationStatus,
} from '../entities/supplier-profile.entity';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import {
  AddCartItemDto,
  CheckoutCartDto,
  UpdateCartItemDto,
} from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  private assertBuyer(user: User) {
    if (user.role !== UserRole.FARMER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only farmers can use the shopping cart');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Suspended accounts cannot use the cart');
    }
  }

  private toCartItemResponse(item: CartItem) {
    const price = Number(item.product?.price ?? 0);
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: price,
      subtotal: Number((price * item.quantity).toFixed(2)),
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            unit: item.product.unit,
            stock: item.product.stock,
            imageUrl: item.product.imageUrl,
            isActive: item.product.isActive,
            supplierProfileId: item.product.supplierProfileId,
            supplier: item.product.supplierProfile
              ? {
                  id: item.product.supplierProfile.id,
                  businessName: item.product.supplierProfile.businessName,
                }
              : undefined,
          }
        : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async getCart(user: User) {
    this.assertBuyer(user);

    const items = await this.cartItemRepository.find({
      where: { userId: user.id },
      relations: ['product', 'product.supplierProfile'],
      order: { createdAt: 'DESC' },
    });

    const mapped = items.map((item) => this.toCartItemResponse(item));
    const totalAmount = mapped.reduce((sum, item) => sum + item.subtotal, 0);
    const supplierCount = new Set(
      mapped.map((item) => item.product?.supplierProfileId).filter(Boolean),
    ).size;

    return {
      count: mapped.length,
      supplierCount,
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: 'RWF',
      items: mapped,
    };
  }

  async addItem(user: User, dto: AddCartItemDto) {
    this.assertBuyer(user);

    const quantity = dto.quantity ?? 1;
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
      relations: ['supplierProfile', 'supplierProfile.user'],
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found or inactive');
    }

    if (
      product.supplierProfile?.verificationStatus !==
        SupplierVerificationStatus.APPROVED ||
      product.supplierProfile?.user?.status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException('Supplier is not available');
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}`,
      );
    }

    let item = await this.cartItemRepository.findOne({
      where: { userId: user.id, productId: dto.productId },
      relations: ['product', 'product.supplierProfile'],
    });

    if (item) {
      const nextQty = item.quantity + quantity;
      if (product.stock < nextQty) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stock}`,
        );
      }
      item.quantity = nextQty;
    } else {
      item = this.cartItemRepository.create({
        userId: user.id,
        productId: dto.productId,
        quantity,
      });
    }

    await this.cartItemRepository.save(item);

    const saved = await this.cartItemRepository.findOne({
      where: { id: item.id },
      relations: ['product', 'product.supplierProfile'],
    });

    return {
      message: 'Item added to cart',
      item: this.toCartItemResponse(saved!),
    };
  }

  async updateItem(user: User, itemId: string, dto: UpdateCartItemDto) {
    this.assertBuyer(user);

    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, userId: user.id },
      relations: ['product', 'product.supplierProfile'],
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (!item.product || item.product.stock < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${item.product?.stock ?? 0}`,
      );
    }

    item.quantity = dto.quantity;
    await this.cartItemRepository.save(item);

    return {
      message: 'Cart item updated',
      item: this.toCartItemResponse(item),
    };
  }

  async removeItem(user: User, itemId: string) {
    this.assertBuyer(user);

    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, userId: user.id },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(item);
    return { message: 'Item removed from cart' };
  }

  async clearCart(user: User) {
    this.assertBuyer(user);
    await this.cartItemRepository.delete({ userId: user.id });
    return { message: 'Cart cleared' };
  }

  async checkout(user: User, dto: CheckoutCartDto) {
    this.assertBuyer(user);

    const cartItems = await this.cartItemRepository.find({
      where: { userId: user.id },
      relations: ['product', 'product.supplierProfile'],
      order: { createdAt: 'ASC' },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Group by supplier for one order per supplier
    const groups = new Map<string, CartItem[]>();
    for (const item of cartItems) {
      if (!item.product?.isActive) {
        throw new BadRequestException(
          `Product "${item.product?.name ?? item.productId}" is unavailable`,
        );
      }
      const supplierId = item.product.supplierProfileId;
      const list = groups.get(supplierId) ?? [];
      list.push(item);
      groups.set(supplierId, list);
    }

    const results: Array<{
      order: unknown;
      payment: unknown;
    }> = [];

    for (const [, items] of groups) {
      const orderResult = await this.orderService.createOrder(user, {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        deliveryAddress: dto.deliveryAddress,
        notes: dto.notes,
      });

      const order = orderResult.order as {
        id: string;
        totalAmount: number;
        buyerId: string;
      };

      const payment = await this.paymentService.createForOrder({
        orderId: order.id,
        buyerId: user.id,
        amount: order.totalAmount,
        method: dto.paymentMethod,
      });

      results.push({
        order: orderResult.order,
        payment: this.paymentService.toPaymentResponse(payment),
      });
    }

    // Clear only successfully checked-out cart
    await this.cartItemRepository.delete({ userId: user.id });

    return {
      message: `Checkout completed. Created ${results.length} order(s).`,
      paymentMethod: dto.paymentMethod,
      ordersCreated: results.length,
      checkouts: results,
    };
  }
}
