import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { UserSubscription } from '../entities/user-subscription.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { EnterpriseLead } from '../entities/enterprise-lead.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { BillingService } from './billing.service';
import { FlutterwaveService } from './flutterwave.service';
import { EntitlementsService } from './entitlements.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { AdminBillingController } from './admin-billing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      UserSubscription,
      PaymentTransaction,
      EnterpriseLead,
      User,
    ]),
    forwardRef(() => AuthModule),
    NotificationModule,
  ],
  controllers: [
    BillingController,
    BillingWebhookController,
    AdminBillingController,
  ],
  providers: [BillingService, FlutterwaveService, EntitlementsService],
  exports: [BillingService, EntitlementsService, FlutterwaveService],
})
export class BillingModule {}
