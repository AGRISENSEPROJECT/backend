import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSubscription } from '../entities/user-subscription.entity';
import { PlanId, PlanLimits, SubscriptionStatus } from './billing.enums';
import { getPlanDefinition } from './plan.definitions';

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(UserSubscription)
    private readonly subscriptionRepository: Repository<UserSubscription>,
  ) {}

  async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { userId, isCurrent: true },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  getLimitsForPlan(planId: PlanId | string): PlanLimits {
    return getPlanDefinition(planId).limits;
  }

  async getLimitsForUser(userId: string): Promise<{
    planId: PlanId | string;
    status: string;
    limits: PlanLimits;
    subscription: UserSubscription | null;
  }> {
    const subscription = await this.getCurrentSubscription(userId);
    const planId = subscription?.planId || PlanId.STARTER;
    const status = subscription?.status || SubscriptionStatus.ACTIVE;
    const effectivePlanId =
      status === SubscriptionStatus.ACTIVE ||
      status === SubscriptionStatus.TRIALING
        ? planId
        : PlanId.STARTER;

    // Pending Pro checkout keeps previous entitlements (usually Starter)
    const limits = this.getLimitsForPlan(
      status === SubscriptionStatus.PENDING_PAYMENT
        ? PlanId.STARTER
        : effectivePlanId === PlanId.PRO || effectivePlanId === PlanId.ENTERPRISE
          ? effectivePlanId
          : PlanId.STARTER,
    );

    // If they have active Pro/Enterprise use those limits
    if (
      subscription &&
      (subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIALING) &&
      (subscription.planId === PlanId.PRO ||
        subscription.planId === PlanId.ENTERPRISE)
    ) {
      return {
        planId: subscription.planId,
        status: subscription.status,
        limits: this.getLimitsForPlan(subscription.planId),
        subscription,
      };
    }

    return {
      planId: PlanId.STARTER,
      status: subscription?.status || SubscriptionStatus.ACTIVE,
      limits: this.getLimitsForPlan(PlanId.STARTER),
      subscription,
    };
  }

  async assertCanCreateFarm(userId: string, currentActiveFarmCount: number) {
    const { limits, planId } = await this.getLimitsForUser(userId);
    if (limits.maxFarms === null) {
      return;
    }
    if (currentActiveFarmCount >= limits.maxFarms) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        message:
          planId === PlanId.STARTER
            ? 'Upgrade to Pro to add more farms'
            : 'Farm limit reached for your current plan',
        limit: 'maxFarms',
        planId,
        maxFarms: limits.maxFarms,
      });
    }
  }

  async assertAiRecommendations(userId: string) {
    const { limits, planId } = await this.getLimitsForUser(userId);
    if (!limits.aiRecommendations) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        message: 'Upgrade to Pro to unlock AI recommendations',
        limit: 'aiRecommendations',
        planId,
      });
    }
  }

  requireSubscription(sub: UserSubscription | null): UserSubscription {
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }
}
