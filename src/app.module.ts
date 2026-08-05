import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FarmModule } from './farm/farm.module';
import { CommunityModule } from './community/community.module';
import { AdminModule } from './admin/admin.module';
import { SupplierModule } from './supplier/supplier.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { NotificationModule } from './notification/notification.module';
import { PaymentModule } from './payment/payment.module';
import { CartModule } from './cart/cart.module';
import { OrganizationModule } from './organization/organization.module';
import { ProgramModule } from './program/program.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WeatherModule } from './weather/weather.module';
import { IoTModule } from './iot/iot.module';
import { YieldModule } from './yield/yield.module';
import { CooperativeModule } from './cooperative/cooperative.module';
import { AuditModule } from './audit/audit.module';
import { JobsModule } from './jobs/jobs.module';
import { User } from './entities/user.entity';
import { Farm } from './entities/farm.entity';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { SoilScan } from './entities/soil-scan.entity';
import { PredictionRun } from './entities/prediction-run.entity';
import { Recommendation } from './entities/recommendation.entity';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Notification } from './entities/notification.entity';
import { CartItem } from './entities/cart-item.entity';
import { Payment } from './entities/payment.entity';
import { Organization } from './entities/organization.entity';
import { Program } from './entities/program.entity';
import { ProgramFarmer } from './entities/program-farmer.entity';
import { WeatherAlert } from './entities/weather-alert.entity';
import { IoTSensor } from './entities/iot-sensor.entity';
import { SensorReading } from './entities/sensor-reading.entity';
import { YieldForecast } from './entities/yield-forecast.entity';
import { Cooperative } from './entities/cooperative.entity';
import { CooperativeMember } from './entities/cooperative-member.entity';
import { PostReport } from './entities/post-report.entity';
import { AuditLog } from './entities/audit-log.entity';
import { PredictionModule } from './prediction/prediction.module';

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
                host: configService.get<string>('DATABASE_HOST'),
                port: databasePort,
                username: configService.get<string>('DATABASE_USERNAME'),
                password: configService.get<string>('DATABASE_PASSWORD'),
                database: configService.get<string>('DATABASE_NAME'),
              }),
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
          entities: [
            User,
            Farm,
            Post,
            Comment,
            Like,
            SoilScan,
            PredictionRun,
            Recommendation,
            SupplierProfile,
            Product,
            Order,
            OrderItem,
            Notification,
            CartItem,
            Payment,
            Organization,
            Program,
            ProgramFarmer,
            WeatherAlert,
            IoTSensor,
            SensorReading,
            YieldForecast,
            Cooperative,
            CooperativeMember,
            PostReport,
            AuditLog,
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
    JobsModule,
    AuthModule,
    FarmModule,
    CommunityModule,
    PredictionModule,
    AdminModule,
    SupplierModule,
    ProductModule,
    OrderModule,
    NotificationModule,
    PaymentModule,
    CartModule,
    OrganizationModule,
    ProgramModule,
    AnalyticsModule,
    WeatherModule,
    IoTModule,
    YieldModule,
    CooperativeModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
