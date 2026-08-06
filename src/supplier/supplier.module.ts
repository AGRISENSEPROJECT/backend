import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierController, SupplierAuthController, MarketplaceController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { SupplierIntelligenceService } from './supplier-intelligence.service';
import { MarketplaceMatchingService } from './marketplace-matching.service';
import { Product } from '../entities/product.entity';
import { Order } from '../entities/order.entity';
import { User } from '../entities/user.entity';
import { SupplierProfile } from '../entities/supplier-profile.entity';
import { Farm } from '../entities/farm.entity';
import { FarmCrop } from '../entities/farm-crop.entity';
import { Recommendation } from '../entities/recommendation.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { CloudinaryService } from '../auth/cloudinary.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, Order, User, SupplierProfile, Farm, FarmCrop,
      Recommendation, PredictionRun,
    ]),
    NotificationModule,
  ],
  controllers: [SupplierController, SupplierAuthController, MarketplaceController],
  providers: [
    SupplierService,
    SupplierIntelligenceService,
    MarketplaceMatchingService,
    CloudinaryService,
  ],
  exports: [SupplierService, MarketplaceMatchingService],
})
export class SupplierModule {}
