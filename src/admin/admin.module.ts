import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { Post } from '../entities/post.entity';
import { PredictionRun } from '../entities/prediction-run.entity';
import { AuthModule } from '../auth/auth.module';
import { SupplierModule } from '../supplier/supplier.module';
import { NotificationModule } from '../notification/notification.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Farm, Post, PredictionRun]),
    AuthModule,
    SupplierModule,
    NotificationModule,
    OrganizationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
