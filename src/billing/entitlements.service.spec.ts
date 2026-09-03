import { EntitlementsService } from './entitlements.service';
import { PlanId, SubscriptionStatus } from './billing.enums';

describe('EntitlementsService', () => {
  const makeService = (subscription: any) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(subscription),
    };
    return new EntitlementsService(repo as any);
  };

  it('allows first farm on Starter', async () => {
    const service = makeService({
      planId: PlanId.STARTER,
      status: SubscriptionStatus.ACTIVE,
      isCurrent: true,
    });
    await expect(service.assertCanCreateFarm('u1', 0)).resolves.toBeUndefined();
  });

  it('allows multiple farms on Starter', async () => {
    const service = makeService({
      planId: PlanId.STARTER,
      status: SubscriptionStatus.ACTIVE,
      isCurrent: true,
    });
    await expect(service.assertCanCreateFarm('u1', 12)).resolves.toBeUndefined();
  });

  it('allows more farms on Pro', async () => {
    const service = makeService({
      planId: PlanId.PRO,
      status: SubscriptionStatus.ACTIVE,
      isCurrent: true,
    });
    await expect(service.assertCanCreateFarm('u1', 5)).resolves.toBeUndefined();
  });
});
