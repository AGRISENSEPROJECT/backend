import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { TestEmailController } from './test-email.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { RedisService } from './redis.service';
import { CloudinaryService } from './cloudinary.service';
import { TokenVerificationService } from './token-verification.service';
import { User } from '../entities/user.entity';
import { Farm } from '../entities/farm.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Farm]),
    forwardRef(() => BillingModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'default-secret-change-in-production',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, TestEmailController],
  providers: [
    AuthService,
    EmailService,
    RedisService,
    CloudinaryService,
    TokenVerificationService,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
  ],
  exports: [AuthService, CloudinaryService, EmailService],
})
export class AuthModule {}