import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from '../entities/notification.entity';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { NOTIFICATION_EMAIL_QUEUE } from '../jobs/queue.constants';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    AuthModule,
    forwardRef(() => JobsModule),
    BullModule.registerQueue({
      name: NOTIFICATION_EMAIL_QUEUE,
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
