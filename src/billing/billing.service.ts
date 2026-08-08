import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { UserSubscription } from '../entities/user-subscription.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { EnterpriseLead } from '../entities/enterprise-lead.entity';
import { EmailService } from '../auth/email.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { AuditService } from '../common/services/audit.service';
import { AuditAction } from '../entities/audit-log.entity';
import {
  BillingCycle,
  EnterpriseLeadStatus,
  PaymentMethodType,
  PaymentTransactionStatus,
  PlanId,
  SubscriptionStatus,
} from './billing.enums';
import { PLAN_DEFINITIONS, getPlanDefinition, getProAmount } from './plan.definitions';
import { FlutterwaveService } from './flutterwave.service';
import { EntitlementsService } from './entitlements.service';
import {
  AdminAssignSubscriptionDto,
  AdminRevokeSubscriptionDto,
  CancelSubscriptionDto,
  CheckoutDto,
  EnterpriseInquiryDto,
} from './dto/billing.dto';

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(UserSubscription)
    private readonly subscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(EnterpriseLead)
    private readonly leadRepository: Repository<EnterpriseLead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly flutterwave: FlutterwaveService,
    private readonly entitlements: EntitlementsService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedPlans();
    } catch (error) {
      this.logger.warn(`Plan seed skipped: ${(error as Error).message}`);
    }
  }

  async seedPlans() {
    for (const def of PLAN_DEFINITIONS) {
      const existing = await this.planRepository.findOne({ where: { id: def.id } });
      if (!existing) {
        await this.planRepository.save(
          this.planRepository.create({
            id: def.id,
            name: def.name,
            description: def.description,
            features: def.features,
            priceMonthly: def.priceMonthly,
            priceAnnualPerMonth: def.priceAnnualPerMonth,
            limits: def.limits,
            isPublic: def.isPublic,
            isActive: true,
          }),
        );
      } else {
        existing.name = def.name;
        existing.description = def.description;
        existing.features = def.features;
        existing.priceMonthly = def.priceMonthly;
        existing.priceAnnualPerMonth = def.priceAnnualPerMonth;
        existing.limits = def.limits;
        existing.isPublic = def.isPublic;
        existing.isActive = true;
        await this.planRepository.save(existing);
      }
    }
  }

  async ensureStarterSubscription(userId: string) {
    await this.seedPlans();
    const current = await this.subscriptionRepository.findOne({
      where: { userId, isCurrent: true },
    });
    if (current) return current;

    const now = new Date();
    const sub = this.subscriptionRepository.create({
      userId,
      planId: PlanId.STARTER,
      billingCycle: null,
      status: SubscriptionStatus.ACTIVE,
      paymentMethod: PaymentMethodType.NONE,
      provider: null,
      amount: 0,
      currency: 'RWF',
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      paymentLabel: null,
      isCurrent: true,
    });
    return this.subscriptionRepository.save(sub);
  }

  async listPublicPlans() {
    await this.seedPlans();
    const plans = await this.planRepository.find({
      where: { isPublic: true, isActive: true },
      order: { priceMonthly: 'ASC' },
    });
    return {
      currency: 'RWF',
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        features: plan.features,
        priceMonthly: plan.priceMonthly,
        priceAnnualPerMonth: plan.priceAnnualPerMonth,
        priceAnnualTotal:
          plan.priceAnnualPerMonth === null || plan.priceAnnualPerMonth === undefined
            ? null
            : plan.priceAnnualPerMonth * 12,
        limits: plan.limits,
        selfServeCheckout: plan.id === PlanId.PRO,
      })),
    };
  }

  serializeSubscription(sub: UserSubscription, limitsOverride?: ReturnType<typeof getPlanDefinition>['limits']) {
    const def = getPlanDefinition(sub.planId);
    const effectiveLimits =
      limitsOverride ||
      (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIALING
        ? def.limits
        : getPlanDefinition(PlanId.STARTER).limits);

    return {
      id: sub.id,
      planId: sub.planId,
      planName: def.name,
      billingCycle: sub.billingCycle,
      status: sub.status,
      paymentMethod: sub.paymentMethod,
      paymentLabel: sub.paymentLabel,
      amount: sub.amount,
      currency: sub.currency,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt,
      provider: sub.provider,
      limits: effectiveLimits,
      features: def.features,
      isCurrent: sub.isCurrent,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };
  }

  async getCurrentSubscription(userId: string) {
    await this.ensureStarterSubscription(userId);
    await this.applyScheduledDowngrades(userId);
    const entitlements = await this.entitlements.getLimitsForUser(userId);
    const sub =
      entitlements.subscription ||
      (await this.subscriptionRepository.findOne({
        where: { userId, isCurrent: true },
        relations: ['plan'],
      }));
    if (!sub) throw new NotFoundException('Subscription not found');
    return {
      subscription: this.serializeSubscription(sub, entitlements.limits),
    };
  }

  async activateStarter(userId: string) {
    await this.ensureStarterSubscription(userId);

    // Cancel pending Pro checkouts
    const pending = await this.subscriptionRepository.find({
      where: {
        userId,
        status: SubscriptionStatus.PENDING_PAYMENT,
      },
    });
    for (const item of pending) {
      item.status = SubscriptionStatus.CANCELED;
      item.isCurrent = false;
      item.canceledAt = new Date();
      await this.subscriptionRepository.save(item);
    }

    let current = await this.subscriptionRepository.findOne({
      where: { userId, isCurrent: true },
    });

    if (!current || current.planId !== PlanId.STARTER || current.status !== SubscriptionStatus.ACTIVE) {
      if (current) {
        current.isCurrent = false;
        await this.subscriptionRepository.save(current);
      }
      current = await this.subscriptionRepository.save(
        this.subscriptionRepository.create({
          userId,
          planId: PlanId.STARTER,
          billingCycle: null,
          status: SubscriptionStatus.ACTIVE,
          paymentMethod: PaymentMethodType.NONE,
          amount: 0,
          currency: 'RWF',
          currentPeriodStart: new Date(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          isCurrent: true,
          paymentLabel: null,
        }),
      );
    }

    return {
      message: 'Starter plan is active',
      subscription: this.serializeSubscription(current),
    };
  }

  async checkout(userId: string, dto: CheckoutDto) {
    if (dto.planId !== PlanId.PRO) {
      throw new BadRequestException(
        'Only Pro supports self-serve checkout. Use enterprise inquiry for custom plans.',
      );
    }
    if (
      dto.method !== PaymentMethodType.MOMO &&
      dto.method !== PaymentMethodType.AIRTEL &&
      dto.method !== PaymentMethodType.CARD
    ) {
      throw new BadRequestException('Unsupported payment method for Pro checkout');
    }
    if (
      (dto.method === PaymentMethodType.MOMO || dto.method === PaymentMethodType.AIRTEL) &&
      !dto.phone
    ) {
      throw new BadRequestException('Phone is required for MoMo / Airtel Money');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.ensureStarterSubscription(userId);

    // Mark previous current non-pending as still current until payment succeeds;
    // create a pending subscription row that becomes current on success.
    const existingCurrent = await this.subscriptionRepository.findOne({
      where: { userId, isCurrent: true },
    });

    // Cancel any other pending checkouts
    const pendingSubs = await this.subscriptionRepository.find({
      where: { userId, status: SubscriptionStatus.PENDING_PAYMENT },
    });
    for (const pending of pendingSubs) {
      pending.status = SubscriptionStatus.CANCELED;
      pending.isCurrent = false;
      pending.canceledAt = new Date();
      await this.subscriptionRepository.save(pending);
    }

    const amount = getProAmount(dto.billingCycle);
    const txRef = this.flutterwave.createTxRef('agspro');
    const paymentLabel = this.flutterwave.buildPaymentLabel(dto.method, dto.phone);

    const pendingSub = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId,
        planId: PlanId.PRO,
        billingCycle: dto.billingCycle,
        status: SubscriptionStatus.PENDING_PAYMENT,
        paymentMethod: dto.method,
        provider: 'flutterwave',
        providerPaymentRef: txRef,
        amount,
        currency: 'RWF',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paymentLabel,
        isCurrent: false, // keep previous plan current until paid
        adminNote: null,
      }),
    );

    // Keep existingCurrent as isCurrent true
    if (existingCurrent && !existingCurrent.isCurrent) {
      existingCurrent.isCurrent = true;
      await this.subscriptionRepository.save(existingCurrent);
    }

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        userId,
        subscriptionId: pendingSub.id,
        amount,
        currency: 'RWF',
        method: dto.method,
        status: PaymentTransactionStatus.PENDING,
        provider: 'flutterwave',
        providerRef: txRef,
        checkoutId: pendingSub.id,
        paymentLabel,
      }),
    );

    let charge;
    try {
      charge = await this.flutterwave.initiateCharge({
        txRef,
        amount,
        currency: 'RWF',
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        method: dto.method,
        phone: dto.phone,
        billingCycle: dto.billingCycle,
        returnUrl: dto.returnUrl,
      });
    } catch (error: any) {
      payment.status = PaymentTransactionStatus.FAILED;
      payment.failureReason = error?.message || 'Checkout initiation failed';
      await this.paymentRepository.save(payment);
      pendingSub.status = SubscriptionStatus.CANCELED;
      pendingSub.canceledAt = new Date();
      await this.subscriptionRepository.save(pendingSub);
      throw new BadRequestException(payment.failureReason);
    }

    if (charge.providerRef && charge.providerRef !== txRef) {
      pendingSub.providerPaymentRef = charge.providerRef;
      payment.providerRef = charge.providerRef;
      await this.subscriptionRepository.save(pendingSub);
      await this.paymentRepository.save(payment);
    }

    return {
      checkoutId: pendingSub.id,
      status: SubscriptionStatus.PENDING_PAYMENT,
      payment: {
        provider: charge.provider,
        mode: charge.mode,
        redirectUrl: charge.redirectUrl,
        message: charge.message,
        providerRef: payment.providerRef,
        sandbox: charge.sandbox === true,
      },
      subscription: this.serializeSubscription(pendingSub),
      transactionId: payment.id,
    };
  }

  async getCheckoutStatus(userId: string, checkoutId: string) {
    const sub = await this.subscriptionRepository.findOne({
      where: { id: checkoutId, userId },
      relations: ['plan'],
    });
    if (!sub) throw new NotFoundException('Checkout not found');

    const payments = await this.paymentRepository.find({
      where: { checkoutId, userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const payment = payments[0];

    // Optionally re-verify with provider if still pending
    if (
      sub.status === SubscriptionStatus.PENDING_PAYMENT &&
      payment?.providerRef &&
      !this.flutterwave.isSandbox()
    ) {
      const verified = await this.flutterwave.verifyTransaction(payment.providerRef);
      if (verified.success) {
        await this.activateProFromPayment({
          userId,
          providerRef: payment.providerRef,
          raw: verified.raw || {},
          amount: verified.amount,
        });
        const refreshed = await this.subscriptionRepository.findOne({
          where: { id: checkoutId },
        });
        return {
          checkoutId,
          status: refreshed?.status,
          subscription: refreshed ? this.serializeSubscription(refreshed) : null,
          payment: payment
            ? { id: payment.id, status: PaymentTransactionStatus.SUCCESSFUL, providerRef: payment.providerRef }
            : null,
        };
      }
    }

    const latest = await this.subscriptionRepository.findOne({ where: { id: checkoutId } });
    return {
      checkoutId,
      status: latest?.status,
      subscription: latest ? this.serializeSubscription(latest) : null,
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            providerRef: payment.providerRef,
            failureReason: payment.failureReason,
          }
        : null,
    };
  }

  async cancelSubscription(userId: string, dto: CancelSubscriptionDto) {
    await this.applyScheduledDowngrades(userId);
    const current = await this.subscriptionRepository.findOne({
      where: { userId, isCurrent: true },
    });
    if (!current) throw new NotFoundException('Subscription not found');

    if (current.planId === PlanId.STARTER) {
      return {
        message: 'Already on Starter',
        subscription: this.serializeSubscription(current),
      };
    }

    const atPeriodEnd = dto.atPeriodEnd !== false;

    if (atPeriodEnd && current.currentPeriodEnd && current.currentPeriodEnd > new Date()) {
      current.cancelAtPeriodEnd = true;
      current.canceledAt = new Date();
      await this.subscriptionRepository.save(current);
      return {
        message:
          'Pro cancellation scheduled. You keep Pro benefits until the current period ends, then you move to Starter.',
        subscription: this.serializeSubscription(current),
        downgradeAt: current.currentPeriodEnd,
      };
    }

    // Immediate downgrade
    current.isCurrent = false;
    current.status = SubscriptionStatus.CANCELED;
    current.canceledAt = new Date();
    current.cancelAtPeriodEnd = false;
    await this.subscriptionRepository.save(current);

    const starter = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId,
        planId: PlanId.STARTER,
        billingCycle: null,
        status: SubscriptionStatus.ACTIVE,
        paymentMethod: PaymentMethodType.NONE,
        amount: 0,
        currency: 'RWF',
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        isCurrent: true,
      }),
    );

    return {
      message: 'Subscription canceled. You are now on Starter.',
      subscription: this.serializeSubscription(starter),
    };
  }

  async resumeSubscription(userId: string) {
    const current = await this.subscriptionRepository.findOne({
      where: { userId, isCurrent: true },
    });
    if (!current) throw new NotFoundException('Subscription not found');
    if (
      current.planId !== PlanId.PRO &&
      current.planId !== PlanId.ENTERPRISE
    ) {
      throw new BadRequestException('Only an active paid plan can be resumed');
    }
    if (!current.cancelAtPeriodEnd) {
      return {
        message: 'Subscription is not scheduled for cancellation',
        subscription: this.serializeSubscription(current),
      };
    }
    current.cancelAtPeriodEnd = false;
    current.canceledAt = null;
    await this.subscriptionRepository.save(current);
    return {
      message: 'Cancellation undone. Your paid plan continues.',
      subscription: this.serializeSubscription(current),
    };
  }

  async createEnterpriseInquiry(userId: string | undefined, dto: EnterpriseInquiryDto) {
    const lead = await this.leadRepository.save(
      this.leadRepository.create({
        userId: userId || null,
        organizationName: dto.organizationName.trim(),
        contactName: dto.contactName.trim(),
        contactEmail: dto.contactEmail.trim().toLowerCase(),
        contactPhone: dto.contactPhone?.trim() || null,
        message: dto.message.trim(),
        status: EnterpriseLeadStatus.NEW,
      }),
    );

    const salesEmail =
      this.configService.get<string>('BILLING_SALES_EMAIL') || 'agrisense8@gmail.com';

    try {
      await this.emailService.sendEnterpriseLeadEmail({
        to: salesEmail,
        lead: {
          id: lead.id,
          organizationName: lead.organizationName,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          message: lead.message,
          userId: lead.userId,
        },
      });
    } catch (error) {
      this.logger.warn(`Enterprise lead email failed: ${(error as Error).message}`);
    }

    return {
      message: 'Enterprise inquiry submitted. Our sales team will contact you shortly.',
      lead: {
        id: lead.id,
        status: lead.status,
        organizationName: lead.organizationName,
        createdAt: lead.createdAt,
      },
    };
  }

  async handleFlutterwaveWebhook(signature: string | undefined, body: any) {
    if (!this.flutterwave.verifyWebhookSignature(signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const data = body?.data || body;
    const txRef = data?.tx_ref || data?.txRef || body?.txRef;
    const eventStatus = (data?.status || body?.status || '').toString().toLowerCase();

    if (!txRef) {
      throw new BadRequestException('Missing tx_ref');
    }

    // Idempotency
    const existingPayment = await this.paymentRepository.findOne({
      where: { providerRef: txRef },
    });
    if (!existingPayment) {
      // Also try flw_ref match stored earlier
      this.logger.warn(`Webhook for unknown tx_ref=${txRef}`);
      return { received: true, ignored: true };
    }

    if (existingPayment.status === PaymentTransactionStatus.SUCCESSFUL) {
      return { received: true, duplicate: true };
    }

    const success =
      eventStatus === 'successful' ||
      eventStatus === 'success' ||
      body?.event === 'charge.completed';

    existingPayment.rawWebhookPayload = body;
    if (!success) {
      existingPayment.status = PaymentTransactionStatus.FAILED;
      existingPayment.failureReason =
        data?.processor_response || data?.message || 'Payment failed';
      await this.paymentRepository.save(existingPayment);

      if (existingPayment.subscriptionId) {
        const pending = await this.subscriptionRepository.findOne({
          where: { id: existingPayment.subscriptionId },
        });
        if (pending && pending.status === SubscriptionStatus.PENDING_PAYMENT) {
          pending.status = SubscriptionStatus.CANCELED;
          pending.canceledAt = new Date();
          await this.subscriptionRepository.save(pending);
        }
      }

      return { received: true, status: 'failed' };
    }

    // Prefer provider verification when not sandbox
    if (!this.flutterwave.isSandbox()) {
      const verified = await this.flutterwave.verifyTransaction(txRef);
      if (!verified.success) {
        existingPayment.status = PaymentTransactionStatus.FAILED;
        existingPayment.failureReason = verified.failureReason || 'Verification failed';
        existingPayment.rawWebhookPayload = {
          webhook: body,
          verification: verified.raw,
        };
        await this.paymentRepository.save(existingPayment);
        return { received: true, status: 'failed_verification' };
      }
    }

    await this.activateProFromPayment({
      userId: existingPayment.userId,
      providerRef: txRef,
      raw: body,
      amount: data?.amount,
    });

    return { received: true, status: 'successful' };
  }

  private async activateProFromPayment(input: {
    userId: string;
    providerRef: string;
    raw: Record<string, unknown>;
    amount?: number;
  }) {
    const payment = await this.paymentRepository.findOne({
      where: { providerRef: input.providerRef },
    });
    if (!payment) {
      throw new NotFoundException('Payment transaction not found');
    }
    if (payment.status === PaymentTransactionStatus.SUCCESSFUL) {
      return;
    }

    const pending = payment.subscriptionId
      ? await this.subscriptionRepository.findOne({ where: { id: payment.subscriptionId } })
      : null;
    if (!pending) {
      throw new NotFoundException('Pending subscription not found');
    }

    const amount = getProAmount(
      (pending.billingCycle as BillingCycle) || BillingCycle.MONTHLY,
    );
    if (input.amount !== undefined && Number(input.amount) !== amount) {
      // Soft check — still accept if provider currency/amount quirks, but log
      this.logger.warn(
        `Amount mismatch for ${input.providerRef}: expected ${amount}, got ${input.amount}`,
      );
    }

    // Demote previous current
    const previous = await this.subscriptionRepository.find({
      where: { userId: input.userId, isCurrent: true },
    });
    for (const prev of previous) {
      prev.isCurrent = false;
      if (prev.status === SubscriptionStatus.ACTIVE && prev.planId !== PlanId.PRO) {
        prev.status = SubscriptionStatus.CANCELED;
        prev.canceledAt = new Date();
      }
      await this.subscriptionRepository.save(prev);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (pending.billingCycle === BillingCycle.ANNUAL) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    pending.status = SubscriptionStatus.ACTIVE;
    pending.isCurrent = true;
    pending.currentPeriodStart = now;
    pending.currentPeriodEnd = periodEnd;
    pending.cancelAtPeriodEnd = false;
    pending.canceledAt = null;
    pending.providerPaymentRef = input.providerRef;
    pending.amount = amount;
    await this.subscriptionRepository.save(pending);

    payment.status = PaymentTransactionStatus.SUCCESSFUL;
    payment.rawWebhookPayload = input.raw;
    payment.failureReason = null;
    await this.paymentRepository.save(payment);

    await this.notificationService.create(
      input.userId,
      'Pro plan activated',
      'Your AgriSense Pro subscription is now active. Enjoy AI recommendations and more farms.',
      NotificationType.SYSTEM,
      { planId: PlanId.PRO, periodEnd: periodEnd.toISOString() },
    );
  }

  async applyScheduledDowngrades(userId?: string) {
    const qb = this.subscriptionRepository
      .createQueryBuilder('sub')
      .where('sub.isCurrent = true')
      .andWhere('sub.cancelAtPeriodEnd = true')
      .andWhere('sub.currentPeriodEnd IS NOT NULL')
      .andWhere('sub.currentPeriodEnd <= NOW()');
    if (userId) qb.andWhere('sub.userId = :userId', { userId });

    const due = await qb.getMany();
    for (const sub of due) {
      sub.isCurrent = false;
      sub.status = SubscriptionStatus.EXPIRED;
      await this.subscriptionRepository.save(sub);
      await this.subscriptionRepository.save(
        this.subscriptionRepository.create({
          userId: sub.userId,
          planId: PlanId.STARTER,
          billingCycle: null,
          status: SubscriptionStatus.ACTIVE,
          paymentMethod: PaymentMethodType.NONE,
          amount: 0,
          currency: 'RWF',
          currentPeriodStart: new Date(),
          currentPeriodEnd: null,
          isCurrent: true,
        }),
      );
    }
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async adminListSubscriptions(page = 1, limit = 20, planId?: string, status?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.subscriptionRepository
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.user', 'user')
      .leftJoinAndSelect('sub.plan', 'plan')
      .where('sub.isCurrent = true')
      .orderBy('sub.updatedAt', 'DESC')
      .skip(skip)
      .take(take);
    if (planId) qb.andWhere('sub.planId = :planId', { planId });
    if (status) qb.andWhere('sub.status = :status', { status });

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((sub) => ({
        ...this.serializeSubscription(sub),
        user: sub.user
          ? {
              id: sub.user.id,
              email: sub.user.email,
              firstName: sub.user.firstName,
              lastName: sub.user.lastName,
            }
          : null,
      })),
      total,
      page: Math.max(page, 1),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async adminListTransactions(page = 1, limit = 20, status?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where = status ? { status } : {};
    const [items, total] = await this.paymentRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
      relations: ['user'],
    });
    return {
      items,
      total,
      page: Math.max(page, 1),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async adminAssign(userId: string, dto: AdminAssignSubscriptionDto, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.seedPlans();

    const current = await this.subscriptionRepository.find({
      where: { userId, isCurrent: true },
    });
    for (const item of current) {
      item.isCurrent = false;
      item.status = SubscriptionStatus.CANCELED;
      item.canceledAt = new Date();
      await this.subscriptionRepository.save(item);
    }

    const now = new Date();
    let periodDays = dto.periodDays;
    if (!periodDays) {
      if (dto.planId === PlanId.PRO) {
        periodDays = dto.billingCycle === BillingCycle.ANNUAL ? 365 : 30;
      } else if (dto.planId === PlanId.ENTERPRISE) {
        periodDays = 365;
      } else {
        periodDays = undefined;
      }
    }

    const periodEnd =
      periodDays && dto.planId !== PlanId.STARTER
        ? new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000)
        : null;

    const amount =
      dto.planId === PlanId.PRO
        ? getProAmount(dto.billingCycle || BillingCycle.MONTHLY)
        : 0;

    const sub = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId,
        planId: dto.planId,
        billingCycle: dto.planId === PlanId.PRO ? dto.billingCycle || BillingCycle.MONTHLY : null,
        status: SubscriptionStatus.ACTIVE,
        paymentMethod: PaymentMethodType.MANUAL,
        provider: 'manual',
        amount,
        currency: 'RWF',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentLabel: 'Manual / Admin',
        isCurrent: true,
        adminNote: dto.note || null,
      }),
    );

    await this.auditService.log(AuditAction.SUBSCRIPTION_ASSIGNED, actorId, user.email, {
      targetUserId: userId,
      planId: dto.planId,
      note: dto.note,
      periodDays,
    });

    await this.notificationService.create(
      userId,
      'Subscription updated',
      `An administrator assigned the ${dto.planId} plan to your account.`,
      NotificationType.SYSTEM,
      { planId: dto.planId },
    );

    return {
      message: `Assigned ${dto.planId} plan`,
      subscription: this.serializeSubscription(sub),
    };
  }

  async adminRevoke(userId: string, dto: AdminRevokeSubscriptionDto, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const current = await this.subscriptionRepository.find({
      where: { userId, isCurrent: true },
    });
    for (const item of current) {
      item.isCurrent = false;
      item.status = SubscriptionStatus.CANCELED;
      item.canceledAt = new Date();
      item.adminNote = dto.note || item.adminNote;
      await this.subscriptionRepository.save(item);
    }

    const starter = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId,
        planId: PlanId.STARTER,
        billingCycle: null,
        status: SubscriptionStatus.ACTIVE,
        paymentMethod: PaymentMethodType.NONE,
        amount: 0,
        currency: 'RWF',
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        isCurrent: true,
        adminNote: dto.note || null,
      }),
    );

    await this.auditService.log(AuditAction.SUBSCRIPTION_REVOKED, actorId, user.email, {
      targetUserId: userId,
      note: dto.note,
    });

    return {
      message: 'Subscription revoked. User is on Starter.',
      subscription: this.serializeSubscription(starter),
    };
  }
}
