import { PlanId, PlanLimits } from './billing.enums';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  features: string[];
  priceMonthly: number | null;
  priceAnnualPerMonth: number | null;
  limits: PlanLimits;
  isPublic: boolean;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: PlanId.STARTER,
    name: 'Starter',
    description: 'Forever free for farmers getting started with AgriSense.',
    features: [
      '1 farm',
      'Basic farm records',
      '3-day weather outlook',
      'Community access',
      'Marketplace browsing',
    ],
    priceMonthly: 0,
    priceAnnualPerMonth: 0,
    limits: {
      maxFarms: 1,
      weatherDays: 3,
      aiRecommendations: false,
      unlimitedSoilReports: false,
      marketInsights: false,
      prioritySupport: false,
    },
    isPublic: true,
  },
  {
    id: PlanId.PRO,
    name: 'Pro',
    description: 'Advanced AI, more farms, and full agricultural insights.',
    features: [
      'Up to 10 farms',
      'AI crop disease recommendations',
      'Unlimited soil & crop reports',
      '7-day weather outlook',
      'Market insights',
      'Priority notification alerts',
    ],
    priceMonthly: 10000,
    priceAnnualPerMonth: 8000,
    limits: {
      maxFarms: 10,
      weatherDays: 7,
      aiRecommendations: true,
      unlimitedSoilReports: true,
      marketInsights: true,
      prioritySupport: false,
    },
    isPublic: true,
  },
  {
    id: PlanId.ENTERPRISE,
    name: 'Enterprise',
    description: 'Custom pricing for organizations, NGOs, and government partners.',
    features: [
      'Unlimited farms (org-level)',
      'Dedicated onboarding',
      'Regional analytics',
      'Custom SLAs',
      'Priority support',
    ],
    priceMonthly: null,
    priceAnnualPerMonth: null,
    limits: {
      maxFarms: null,
      weatherDays: null,
      aiRecommendations: true,
      unlimitedSoilReports: true,
      marketInsights: true,
      prioritySupport: true,
    },
    isPublic: true,
  },
];

export function getPlanDefinition(planId: PlanId | string): PlanDefinition {
  const plan = PLAN_DEFINITIONS.find((p) => p.id === planId);
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return plan;
}

export function getProAmount(billingCycle: 'monthly' | 'annual'): number {
  if (billingCycle === 'annual') {
    return 96000; // 8000 * 12
  }
  return 10000;
}
