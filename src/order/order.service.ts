import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import {
  SupplierProfile,
  SupplierVerificationStatus,
} from '../entities/supplier-profile.entity';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(SupplierProfile)
    private readonly supplierProfileRepository: Repository<SupplierProfile>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly paymentService: PaymentService,
  ) {}

  private toOrderResponse(order: Order) {
    return {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      buyerId: order.buyerId,
      supplierProfileId: order.supplierProfileId,
      buyer: order.buyer
        ? {
            id: order.buyer.id,
            username: order.buyer.username,
            email: order.buyer.email,
            phoneNumber: order.buyer.phoneNumber,
          }
        : undefined,
      supplier: order.supplierProfile
        ? {
            id: order.supplierProfile.id,
            businessName: order.supplierProfile.businessName,
            phone: order.supplierProfile.phone,
          }
        : undefined,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              unit: item.product.unit,
              imageUrl: item.product.imageUrl,
            }
          : undefined,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async createOrder(buyer: User, dto: CreateOrderDto) {
    if (buyer.role !== UserRole.FARMER && buyer.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only farmers can place marketplace orders');
    }

    if (buyer.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Suspended accounts cannot place orders');
    }

    const productIds = dto.items.map((item) => item.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException('Duplicate products in order are not allowed');
    }

    return this.dataSource.transaction(async (manager) => {
      const products = await manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id IN (:...productIds)', { productIds })
        .getMany();

      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products were not found');
      }

      const supplierIds = new Set(products.map((p) => p.supplierProfileId));
      if (supplierIds.size !== 1) {
        throw new BadRequestException(
          'All products in an order must belong to the same supplier',
        );
      }

      const supplierProfileId = products[0].supplierProfileId;
      const supplierProfile = await manager.findOne(SupplierProfile, {
        where: { id: supplierProfileId },
        relations: ['user'],
      });

      if (
        !supplierProfile ||
        supplierProfile.verificationStatus !==
          SupplierVerificationStatus.APPROVED ||
        supplierProfile.user?.status !== UserStatus.ACTIVE
      ) {
        throw new BadRequestException('Supplier is not available for orders');
      }

      let totalAmount = 0;
      const preparedItems: Array<{
        product: Product;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      for (const requestItem of dto.items) {
        const product = products.find((p) => p.id === requestItem.productId)!;

        if (!product.isActive) {
          throw new BadRequestException(`Product "${product.name}" is not available`);
        }

        if (product.stock < requestItem.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          );
        }

        const unitPrice = Number(product.price);
        const subtotal = Number((unitPrice * requestItem.quantity).toFixed(2));
        totalAmount += subtotal;

        preparedItems.push({
          product,
          quantity: requestItem.quantity,
          unitPrice,
          subtotal,
        });
      }

      const order = manager.create(Order, {
        buyerId: buyer.id,
        supplierProfileId: supplierProfile.id,
        status: OrderStatus.PENDING,
        totalAmount: Number(totalAmount.toFixed(2)),
        deliveryAddress: dto.deliveryAddress ?? null,
        notes: dto.notes ?? null,
      });
      await manager.save(order);

      for (const prepared of preparedItems) {
        prepared.product.stock -= prepared.quantity;
        await manager.save(prepared.product);

        const orderItem = manager.create(OrderItem, {
          orderId: order.id,
          productId: prepared.product.id,
          quantity: prepared.quantity,
          unitPrice: prepared.unitPrice,
          subtotal: prepared.subtotal,
        });
        await manager.save(orderItem);
      }

      const saved = await manager.findOne(Order, {
        where: { id: order.id },
        relations: [
          'buyer',
          'supplierProfile',
          'supplierProfile.user',
          'items',
          'items.product',
        ],
      });

      const orderResponse = this.toOrderResponse(saved!);

      if (saved?.supplierProfile?.userId) {
        await this.notificationService.create({
          userId: saved.supplierProfile.userId,
          type: NotificationType.ORDER_PLACED,
          title: 'New order received',
          message: `You received a new order totaling ${Number(saved.totalAmount).toLocaleString()} RWF.`,
          data: {
            orderId: saved.id,
            buyerId: saved.buyerId,
            totalAmount: Number(saved.totalAmount),
            status: saved.status,
          },
        });
      }

      const paymentEntity = dto.paymentMethod && saved
        ? await this.paymentService.createForOrder({
            orderId: saved.id,
            buyerId: saved.buyerId,
            amount: Number(saved.totalAmount),
            method: dto.paymentMethod,
          })
        : null;

      return {
        message: 'Order placed successfully',
        order: orderResponse,
        payment: paymentEntity
          ? this.paymentService.toPaymentResponse(paymentEntity)
          : null,
      };
    });
  }

  async getMyOrders(buyer: User, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.orderRepository.findAndCount({
      where: {
        buyerId: buyer.id,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: ['supplierProfile', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) => this.toOrderResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getSupplierOrders(supplierUser: User, query: ListOrdersQueryDto) {
    const profile = await this.supplierProfileRepository.findOne({
      where: { userId: supplierUser.id },
    });

    if (!profile) {
      throw new NotFoundException('Supplier profile not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.orderRepository.findAndCount({
      where: {
        supplierProfileId: profile.id,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: ['buyer', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) => this.toOrderResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getOrder(actor: User, orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'buyer',
        'supplierProfile',
        'supplierProfile.user',
        'items',
        'items.product',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isBuyer = order.buyerId === actor.id;
    const isSupplierOwner = order.supplierProfile?.userId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isBuyer && !isSupplierOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.toOrderResponse(order);
  }

  async updateStatus(actor: User, orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'buyer',
        'supplierProfile',
        'supplierProfile.user',
        'items',
        'items.product',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isBuyer = order.buyerId === actor.id;
    const isSupplierOwner = order.supplierProfile?.userId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isBuyer && !isSupplierOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this order');
    }

    this.assertValidTransition(order.status, dto.status, {
      isBuyer,
      isSupplierOwner,
      isAdmin,
    });

    return this.dataSource.transaction(async (manager) => {
      if (
        dto.status === OrderStatus.CANCELLED &&
        order.status !== OrderStatus.CANCELLED
      ) {
        for (const item of order.items ?? []) {
          const product = await manager.findOne(Product, {
            where: { id: item.productId },
            lock: { mode: 'pessimistic_write' },
          });
          if (product) {
            product.stock += item.quantity;
            await manager.save(product);
          }
        }
      }

      order.status = dto.status;
      await manager.save(order);

      if (dto.status === OrderStatus.CANCELLED) {
        await this.paymentService.cancelForOrder(order.id);
      }

      const refreshed = await manager.findOne(Order, {
        where: { id: order.id },
        relations: [
          'buyer',
          'supplierProfile',
          'supplierProfile.user',
          'items',
          'items.product',
        ],
      });

      if (refreshed) {
        await this.notifyOrderStatusChange(refreshed, actor.id);
      }

      return {
        message: `Order status updated to ${dto.status}`,
        order: this.toOrderResponse(refreshed!),
      };
    });
  }

  private async notifyOrderStatusChange(order: Order, actorId: string) {
    const statusLabel = order.status.replace('_', ' ');

    // Always notify the buyer about status changes made by others
    if (order.buyerId !== actorId) {
      await this.notificationService.create({
        userId: order.buyerId,
        type: NotificationType.ORDER_STATUS,
        title: `Order ${statusLabel}`,
        message: `Your order is now ${statusLabel}.`,
        data: {
          orderId: order.id,
          status: order.status,
          totalAmount: Number(order.totalAmount),
        },
      });
    }

    // Notify supplier when buyer cancels
    if (
      order.status === OrderStatus.CANCELLED &&
      order.supplierProfile?.userId &&
      order.supplierProfile.userId !== actorId
    ) {
      await this.notificationService.create({
        userId: order.supplierProfile.userId,
        type: NotificationType.ORDER_STATUS,
        title: 'Order cancelled',
        message: 'A buyer cancelled an order.',
        data: {
          orderId: order.id,
          status: order.status,
          buyerId: order.buyerId,
        },
      });
    }
  }

  private assertValidTransition(
    current: OrderStatus,
    next: OrderStatus,
    actors: { isBuyer: boolean; isSupplierOwner: boolean; isAdmin: boolean },
  ) {
    if (current === next) {
      throw new BadRequestException('Order already has this status');
    }

    if (current === OrderStatus.CANCELLED || current === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Cannot change status of a ${current} order`,
      );
    }

    // Buyer can only cancel pending orders
    if (actors.isBuyer && !actors.isSupplierOwner && !actors.isAdmin) {
      if (next !== OrderStatus.CANCELLED || current !== OrderStatus.PENDING) {
        throw new ForbiddenException(
          'Buyers can only cancel pending orders',
        );
      }
      return;
    }

    const supplierTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!supplierTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }
}
