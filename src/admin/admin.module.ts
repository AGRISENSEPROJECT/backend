import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { Post } from '../entities/post.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { SupplierProfile } from '../entities/supplier-profile.entity';
import { NgoOrganization } from '../entities/ngo-organization.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, Farm, Post, PredictionRun, Order, Product,
      SupplierProfile, NgoOrganization, AuditLog,
    ]),
    NotificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
