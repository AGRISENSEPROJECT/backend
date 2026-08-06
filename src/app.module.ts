import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FarmModule } from './farm/farm.module';
import { CommunityModule } from './community/community.module';
import { User } from './entities/user.entity';
import { Farm } from './entities/farm.entity';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { SoilScan } from './entities/soil-scan.entity';
import { PredictionRun } from './entities/prediction-run.entity';
import { Recommendation } from './entities/recommendation.entity';
import { AdminModule } from './admin/admin.module';
import { SupplierModule } from './supplier/supplier.module';
import { RegionalModule } from './regional/regional.module';
import { NotificationModule } from './notification/notification.module';
import { PostReport } from './entities/post-report.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Notification } from './entities/notification.entity';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { AuditLog } from './entities/audit-log.entity';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { NgoOrganization } from './entities/ngo-organization.entity';
import { AgriculturalProgram } from './entities/agricultural-program.entity';
import { GovernmentAdvisory } from './entities/government-advisory.entity';
import { FarmCrop } from './entities/farm-crop.entity';
import { PredictionModule } from './prediction/prediction.module';
import { CommonModule } from './common/common.module';
import { AppBootstrapService } from './app.bootstrap.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const isDevelopment = configService.get('NODE_ENV') === 'development';
        const useSsl = configService.get('DATABASE_SSL') === 'true' || !!databaseUrl;
        const databasePort = Number(configService.get<string>('DATABASE_PORT') || 5432);

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: configService.get<string>('DATABASE_HOST') || 'localhost',
                port: databasePort,
                username: configService.get<string>('DATABASE_USERNAME') || 'postgres',
                password: configService.get<string>('DATABASE_PASSWORD') || 'postgres123',
                database: configService.get<string>('DATABASE_NAME') || 'agrisense',
              }),
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
          entities: [
            User, Farm, Post, Comment, Like, SoilScan, PredictionRun, Recommendation,
            PostReport, ChatMessage, Notification, Product, Order,
            AuditLog, SupplierProfile, NgoOrganization, AgriculturalProgram, GovernmentAdvisory,
            FarmCrop,
          ],
          synchronize: configService.get('TYPEORM_SYNCHRONIZE') === 'true' || isDevelopment,
          logging: isDevelopment,
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    CommonModule,
    AuthModule,
    FarmModule,
    CommunityModule,
    PredictionModule,
    AdminModule,
    SupplierModule,
    RegionalModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppBootstrapService],
})
export class AppModule { }
