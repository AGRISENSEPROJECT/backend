import { PlanId, SubscriptionStatus, PaymentTransactionStatus, BillingCycle, PaymentMethodType } from './billing.enums';
import { BillingService } from './billing.service';

describe('BillingService flows', () => {
  const userId = 'user-1';
  let plans: any[];
  let subscriptions: any[];
  let payments: any[];
  let leads: any[];
  let users: any[];

  const makeRepo = (store: any[], idField = 'id') => ({
    find: jest.fn(async ({ where }: any = {}) =>
      store.filter((row) =>
        !where ||
        Object.entries(where).every(([k, v]) => row[k] === v),
      ),
    ),
    findOne: jest.fn(async ({ where }: any = {}) =>
      store.find((row) =>
        !where ||
        Object.entries(where).every(([k, v]) => row[k] === v),
      ) || null,
    ),
    findAndCount: jest.fn(async () => [store, store.length]),
    create: jest.fn((data: any) => ({
      id: data.id || `${idField}-${store.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    })),
    save: jest.fn(async (entity: any) => {
      const idx = store.findIndex((r) => r.id === entity.id);
      if (idx >= 0) store[idx] = entity;
      else store.push(entity);
      return entity;
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        where: () => qb,
        andWhere: () => qb,
        leftJoinAndSelect: () => qb,
        orderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getMany: async () => [],
        getManyAndCount: async () => [[], 0],
      };
      return qb;
    }),
  });

  let service: BillingService;
  let planRepo: any;
  let subRepo: any;
  let payRepo: any;
  let leadRepo: any;
  let userRepo: any;
  let flutterwave: any;
  let entitlements: any;
  let emailService: any;
  let notificationService: any;
  let auditService: any;
  let configService: any;

  beforeEach(() => {
    plans = [];
    subscriptions = [];
    payments = [];
    leads = [];
    users = [{ id: userId, email: 'farmer@example.com', firstName: 'A', lastName: 'B' }];

    planRepo = makeRepo(plans);
    subRepo = makeRepo(subscriptions);
    payRepo = makeRepo(payments);
    leadRepo = makeRepo(leads);
    userRepo = makeRepo(users);

    flutterwave = {
      isSandbox: () => true,
      createTxRef: () => 'agspro_test_ref',
      buildPaymentLabel: () => 'MTN MoMo · 078***3456',
      initiateCharge: jest.fn(async () => ({
        provider: 'flutterwave',
        mode: 'sandbox',
        providerRef: 'agspro_test_ref',
        message: 'Sandbox',
        sandbox: true,
      })),
      verifyWebhookSignature: () => true,
      verifyTransaction: jest.fn(async () => ({ success: true, amount: 10000 })),
    };

    entitlements = {
      getLimitsForUser: jest.fn(async () => ({
        planId: PlanId.STARTER,
        status: SubscriptionStatus.ACTIVE,
        limits: { maxFarms: 1 },
        subscription: subscriptions.find((s) => s.isCurrent) || null,
      })),
    };

    emailService = { sendEnterpriseLeadEmail: jest.fn(async () => undefined) };
    notificationService = { create: jest.fn(async () => undefined) };
    auditService = { log: jest.fn(async () => undefined) };
    configService = { get: () => 'agrisense8@gmail.com' };

    service = new BillingService(
      planRepo,
      subRepo,
      payRepo,
      leadRepo,
      userRepo,
      flutterwave,
      entitlements,
      emailService,
      notificationService,
      auditService,
      configService,
    );
  });

  it('seeds plans and activates Starter by default', async () => {
    const sub = await service.ensureStarterSubscription(userId);
    expect(sub.planId).toBe(PlanId.STARTER);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(plans.length).toBe(3);
  });

  it('checkout stays pending until webhook success activates Pro', async () => {
    await service.ensureStarterSubscription(userId);
    const checkout = await service.checkout(userId, {
      planId: PlanId.PRO,
      billingCycle: BillingCycle.MONTHLY,
      method: PaymentMethodType.MOMO,
      phone: '+250788123456',
    } as any);

    expect(checkout.status).toBe(SubscriptionStatus.PENDING_PAYMENT);
    const current = subscriptions.find((s) => s.isCurrent);
    expect(current.planId).toBe(PlanId.STARTER);

    await service.handleFlutterwaveWebhook(undefined, {
      event: 'charge.completed',
      data: { tx_ref: 'agspro_test_ref', status: 'successful', amount: 10000 },
    });

    const active = subscriptions.find((s) => s.isCurrent);
    expect(active.planId).toBe(PlanId.PRO);
    expect(active.status).toBe(SubscriptionStatus.ACTIVE);
    expect(active.currentPeriodEnd).toBeTruthy();
    expect(payments[0].status).toBe(PaymentTransactionStatus.SUCCESSFUL);
  });

  it('failed payment keeps previous plan', async () => {
    await service.ensureStarterSubscription(userId);
    await service.checkout(userId, {
      planId: PlanId.PRO,
      billingCycle: BillingCycle.MONTHLY,
      method: PaymentMethodType.MOMO,
      phone: '+250788123456',
    } as any);

    await service.handleFlutterwaveWebhook(undefined, {
      data: { tx_ref: 'agspro_test_ref', status: 'failed' },
    });

    const current = subscriptions.find((s) => s.isCurrent);
    expect(current.planId).toBe(PlanId.STARTER);
    expect(payments[0].status).toBe(PaymentTransactionStatus.FAILED);
  });

  it('cancel at period end schedules downgrade', async () => {
    await service.ensureStarterSubscription(userId);
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const starter = subscriptions.find((s) => s.isCurrent);
    starter.isCurrent = false;
    subscriptions.push({
      id: 'pro-1',
      userId,
      planId: PlanId.PRO,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      isCurrent: true,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      amount: 10000,
      currency: 'RWF',
      paymentMethod: PaymentMethodType.MOMO,
    });

    const result = await service.cancelSubscription(userId, { atPeriodEnd: true });
    expect(result.subscription.cancelAtPeriodEnd).toBe(true);
    expect(result.subscription.planId).toBe(PlanId.PRO);
  });

  it('enterprise inquiry creates lead and emails sales', async () => {
    const result = await service.createEnterpriseInquiry(userId, {
      organizationName: 'Green Org',
      contactName: 'Jean',
      contactEmail: 'jean@example.com',
      message: 'Need 200 seats',
    } as any);
    expect(result.lead.id).toBeTruthy();
    expect(leads).toHaveLength(1);
    expect(emailService.sendEnterpriseLeadEmail).toHaveBeenCalled();
  });
});
