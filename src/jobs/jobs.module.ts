import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationEmailProcessor } from './notification-email.processor';
import { NOTIFICATION_EMAIL_QUEUE } from './queue.constants';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    AuthModule,
    TypeOrmModule.forFeature([User]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return { connection: { url: redisUrl } };
        }
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: Number(configService.get<string>('REDIS_PORT') || 6379),
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_EMAIL_QUEUE,
    }),
  ],
  providers: [NotificationEmailProcessor],
  exports: [BullModule, ScheduleModule],
})
export class JobsModule {}
