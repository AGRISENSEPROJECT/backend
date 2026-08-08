export enum PlanId {
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  PENDING_PAYMENT = 'pending_payment',
  EXPIRED = 'expired',
}

export enum PaymentMethodType {
  MOMO = 'momo',
  AIRTEL = 'airtel',
  CARD = 'card',
  MANUAL = 'manual',
  NONE = 'none',
}

export enum PaymentTransactionStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum EnterpriseLeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CONVERTED = 'converted',
}

export type PlanLimits = {
  maxFarms: number | null;
  weatherDays: number | null;
  aiRecommendations: boolean;
  unlimitedSoilReports: boolean;
  marketInsights: boolean;
  prioritySupport: boolean;
};
