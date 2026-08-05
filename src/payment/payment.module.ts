import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Order } from '../entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { FlutterwaveService } from './flutterwave.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order]),
    AuthModule,
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, FlutterwaveService],
  exports: [PaymentService],
})
export class PaymentModule {}
