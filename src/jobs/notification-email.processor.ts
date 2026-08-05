import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { EmailService } from '../auth/email.service';
import { User } from '../entities/user.entity';
import {
  NOTIFICATION_EMAIL_QUEUE,
  NotificationEmailJob,
} from './queue.constants';

@Processor(NOTIFICATION_EMAIL_QUEUE)
export class NotificationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationEmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super();
  }

  async process(job: Job<NotificationEmailJob>) {
    const { userId, title, message, type, notificationId } = job.data;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.email) {
      this.logger.warn(`No email for user ${userId}; skipping notification email`);
      return;
    }

    await this.emailService.sendNotificationEmail(user.email, title, message, type);
    this.logger.log(
      `Sent notification email for ${notificationId} to ${user.email}`,
    );
  }
}
