import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../entities/payment.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { ListPaymentsQueryDto, VerifyPaymentDto } from './dto/payment.dto';
import { FlutterwaveService } from './flutterwave.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly notificationService: NotificationService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly configService: ConfigService,
  ) {}

  toPaymentResponse(payment: Payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      buyerId: payment.buyerId,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      providerReference: payment.providerReference,
      checkoutUrl: payment.checkoutUrl,
      providerTransactionId: payment.providerTransactionId,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: payment.order
        ? {
            id: payment.order.id,
            status: payment.order.status,
            supplierProfileId: payment.order.supplierProfileId,
          }
        : undefined,
    };
  }

  async createForOrder(input: {
    orderId: string;
    buyerId: string;
    amount: number;
    method: PaymentMethod;
  }) {
    const existing = await this.paymentRepository.findOne({
      where: { orderId: input.orderId },
    });
    if (existing) {
      return existing;
    }

    const payment = this.paymentRepository.create({
      orderId: input.orderId,
      buyerId: input.buyerId,
      amount: input.amount,
      method: input.method,
      status: PaymentStatus.PENDING,
      currency: 'RWF',
      providerReference: null,
      checkoutUrl: null,
      providerTransactionId: null,
      providerMeta: null,
      failureReason: null,
      paidAt: null,
    });

    const saved = await this.paymentRepository.save(payment);

    // Stable Flutterwave tx_ref tied to payment id
    if (saved.method === PaymentMethod.MOBILE_MONEY) {
      saved.providerReference = `AGS-${saved.id}`;
      await this.paymentRepository.save(saved);
    }

    return saved;
  }

  async getMyPayments(user: User, query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.paymentRepository.findAndCount({
      where: {
        buyerId: user.id,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: ['order'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) => this.toPaymentResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getById(actor: User, paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order', 'order.supplierProfile', 'buyer'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.assertCanAccess(actor, payment);
    return this.toPaymentResponse(payment);
  }

  async getByOrderId(actor: User, orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      relations: ['order', 'order.supplierProfile', 'buyer'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    await this.assertCanAccess(actor, payment);
    return this.toPaymentResponse(payment);
  }

  /**
   * Start Flutterwave checkout for a mobile_money payment.
   * Returns a checkoutUrl the client should open.
   */
  async initiateProviderCheckout(actor: User, paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['buyer', 'order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.buyerId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the buyer can initiate this payment');
    }

    if (payment.method !== PaymentMethod.MOBILE_MONEY) {
      throw new BadRequestException(
        'Only mobile_money payments use Flutterwave checkout',
      );
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Payment is already paid');
    }

    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot initiate a ${payment.status} payment`,
      );
    }

    if (!payment.buyer?.email) {
      throw new BadRequestException('Buyer email is required for checkout');
    }

    if (!payment.providerReference) {
      payment.providerReference = `AGS-${payment.id}`;
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    const redirectUrl = `${frontendUrl.replace(/\/$/, '')}/payments/callback`;

    const init = await this.flutterwaveService.initializePayment({
      txRef: payment.providerReference,
      amount: Number(payment.amount),
      currency: payment.currency || 'RWF',
      customerEmail: payment.buyer.email,
      customerName: payment.buyer.username || payment.buyer.email,
      customerPhone: payment.buyer.phoneNumber,
      redirectUrl,
      meta: {
        paymentId: payment.id,
        orderId: payment.orderId,
        buyerId: payment.buyerId,
      },
      paymentOptions: 'mobilemoney,card',
    });

    payment.checkoutUrl = init.checkoutUrl;
    payment.status = PaymentStatus.PENDING;
    payment.failureReason = null;
    payment.providerMeta = {
      ...(payment.providerMeta ?? {}),
      lastInit: init.raw,
    };
    await this.paymentRepository.save(payment);

    return {
      message: 'Flutterwave checkout initialized',
      checkoutUrl: payment.checkoutUrl,
      payment: this.toPaymentResponse(payment),
    };
  }

  /**
   * Verify Flutterwave transaction after redirect and mark paid if valid.
   */
  async verifyProviderPayment(actor: User, dto: VerifyPaymentDto) {
    const verified = await this.flutterwaveService.verifyTransaction(
      dto.transactionId,
    );

    const payment = await this.paymentRepository.findOne({
      where: { providerReference: verified.txRef },
      relations: ['order', 'order.supplierProfile', 'buyer'],
    });

    if (!payment) {
      throw new NotFoundException(
        'Payment not found for Flutterwave tx_ref',
      );
    }

    if (payment.buyerId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    if (dto.txRef && dto.txRef !== payment.providerReference) {
      throw new BadRequestException('txRef does not match this payment');
    }

    return this.applyProviderVerification(payment, verified);
  }

  /**
   * Flutterwave webhook handler (public). Always re-verifies with API.
   */
  async handleProviderWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
  ) {
    const incomingHash = headers['verif-hash'] ?? headers['Verif-Hash'];
    if (!this.flutterwaveService.verifyWebhookHash(incomingHash)) {
      this.logger.warn('Rejected Flutterwave webhook: invalid verif-hash');
      throw new ForbiddenException('Invalid webhook signature');
    }

    const data = (body.data ?? body) as Record<string, unknown>;
    const transactionId = data.id ?? data.transaction_id;
    const txRef = String(data.tx_ref ?? '');

    if (!transactionId) {
      throw new BadRequestException('Webhook missing transaction id');
    }

    const verified = await this.flutterwaveService.verifyTransaction(
      transactionId as string | number,
    );

    const payment = await this.paymentRepository.findOne({
      where: {
        providerReference: verified.txRef || txRef,
      },
      relations: ['order', 'order.supplierProfile', 'buyer'],
    });

    if (!payment) {
      this.logger.warn(
        `Webhook for unknown tx_ref=${verified.txRef || txRef}`,
      );
      return { message: 'Webhook ignored: payment not found' };
    }

    if (payment.status === PaymentStatus.PAID) {
      return {
        message: 'Payment already marked as paid',
        payment: this.toPaymentResponse(payment),
      };
    }

    const result = await this.applyProviderVerification(payment, verified);
    return {
      ...result,
      message: `Webhook processed: ${result.message}`,
    };
  }

  /**
   * Confirm payment:
   * - cash_on_delivery: supplier/admin marks paid
   * - mobile_money: must use Flutterwave verify/webhook (not manual confirm)
   */
  async confirmPayment(actor: User, paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order', 'order.supplierProfile'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.method === PaymentMethod.MOBILE_MONEY) {
      throw new BadRequestException(
        'Mobile money payments must be confirmed via Flutterwave. Use POST /payments/:id/initiate then /payments/verify or wait for webhook.',
      );
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Payment is already paid');
    }

    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot confirm a ${payment.status} payment`,
      );
    }

    const isSupplier = payment.order?.supplierProfile?.userId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isSupplier && !isAdmin) {
      throw new ForbiddenException(
        'Only the supplier can confirm cash-on-delivery payment',
      );
    }

    return this.markPaid(payment, {
      providerReference: payment.providerReference ?? `COD-${Date.now()}`,
      providerTransactionId: null,
      providerMeta: { confirmedBy: actor.id, channel: 'cash_on_delivery' },
    });
  }

  async markFailed(actor: User, paymentId: string, reason?: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order', 'order.supplierProfile'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.buyerId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be marked failed');
    }

    if (payment.method !== PaymentMethod.MOBILE_MONEY) {
      throw new BadRequestException(
        'Only mobile money payments can be marked failed by the buyer',
      );
    }

    payment.status = PaymentStatus.FAILED;
    payment.failureReason = reason ?? 'Payment failed';
    await this.paymentRepository.save(payment);

    await this.notificationService.create({
      userId: payment.buyerId,
      type: NotificationType.PAYMENT_UPDATE,
      title: 'Payment failed',
      message: payment.failureReason,
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
      },
    });

    return {
      message: 'Payment marked as failed',
      payment: this.toPaymentResponse(payment),
    };
  }

  async cancelForOrder(orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
    });

    if (!payment) {
      return null;
    }

    if (payment.status === PaymentStatus.PAID) {
      payment.status = PaymentStatus.REFUNDED;
    } else if (payment.status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.CANCELLED;
    }

    await this.paymentRepository.save(payment);

    await this.notificationService.create({
      userId: payment.buyerId,
      type: NotificationType.PAYMENT_UPDATE,
      title: 'Payment updated',
      message: `Payment was ${payment.status} because the order was cancelled.`,
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
      },
    });

    return payment;
  }

  private async applyProviderVerification(
    payment: Payment,
    verified: {
      status: string;
      amount: number;
      chargedAmount: number;
      currency: string;
      txRef: string;
      transactionId: string | number;
      raw: Record<string, unknown>;
    },
  ) {
    const expectedAmount = Number(payment.amount);
    const paidAmount = Number(verified.chargedAmount || verified.amount);
    const currency = (payment.currency || 'RWF').toUpperCase();

    if (verified.txRef && verified.txRef !== payment.providerReference) {
      throw new BadRequestException('Flutterwave tx_ref mismatch');
    }

    if (verified.currency.toUpperCase() !== currency) {
      throw new BadRequestException('Flutterwave currency mismatch');
    }

    if (paidAmount < expectedAmount) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = `Paid amount ${paidAmount} is less than expected ${expectedAmount}`;
      payment.providerMeta = {
        ...(payment.providerMeta ?? {}),
        lastVerify: verified.raw,
      };
      await this.paymentRepository.save(payment);
      throw new BadRequestException(payment.failureReason);
    }

    if (verified.status !== 'successful') {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = `Flutterwave status: ${verified.status}`;
      payment.providerTransactionId = String(verified.transactionId);
      payment.providerMeta = {
        ...(payment.providerMeta ?? {}),
        lastVerify: verified.raw,
      };
      await this.paymentRepository.save(payment);

      return {
        message: 'Payment not successful',
        payment: this.toPaymentResponse(payment),
      };
    }

    if (payment.status === PaymentStatus.PAID) {
      return {
        message: 'Payment already confirmed',
        payment: this.toPaymentResponse(payment),
      };
    }

    return this.markPaid(payment, {
      providerReference: payment.providerReference,
      providerTransactionId: String(verified.transactionId),
      providerMeta: {
        ...(payment.providerMeta ?? {}),
        lastVerify: verified.raw,
      },
    });
  }

  private async markPaid(
    payment: Payment,
    extras: {
      providerReference: string | null;
      providerTransactionId: string | null;
      providerMeta: Record<string, unknown> | null;
    },
  ) {
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.failureReason = null;
    payment.providerReference = extras.providerReference;
    payment.providerTransactionId = extras.providerTransactionId;
    payment.providerMeta = extras.providerMeta;
    await this.paymentRepository.save(payment);

    if (payment.order && payment.order.status === OrderStatus.PENDING) {
      payment.order.status = OrderStatus.CONFIRMED;
      await this.orderRepository.save(payment.order);
    }

    await this.notificationService.create({
      userId: payment.buyerId,
      type: NotificationType.PAYMENT_UPDATE,
      title: 'Payment confirmed',
      message: `Payment of ${Number(payment.amount).toLocaleString()} ${payment.currency} was confirmed.`,
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
        method: payment.method,
      },
    });

    if (payment.order?.supplierProfile?.userId) {
      await this.notificationService.create({
        userId: payment.order.supplierProfile.userId,
        type: NotificationType.PAYMENT_UPDATE,
        title: 'Payment received',
        message: `Payment for order was confirmed (${payment.method}).`,
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          status: payment.status,
          method: payment.method,
        },
      });
    }

    return {
      message: 'Payment confirmed successfully',
      payment: this.toPaymentResponse(payment),
    };
  }

  private async assertCanAccess(actor: User, payment: Payment) {
    const isBuyer = payment.buyerId === actor.id;
    const isSupplier = payment.order?.supplierProfile?.userId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isBuyer && !isSupplier && !isAdmin) {
      throw new ForbiddenException('You do not have access to this payment');
    }
  }
}
