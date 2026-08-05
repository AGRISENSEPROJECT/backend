import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../entities/notification.entity';
import { ListNotificationsQueryDto } from './dto/notification.dto';
import {
  NOTIFICATION_EMAIL_QUEUE,
  NotificationEmailJob,
} from '../jobs/queue.constants';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly notificationEmailQueue: Queue<NotificationEmailJob>,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = this.notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? null,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);
    await this.enqueueEmail(saved);
    return saved;
  }

  async createMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) {
      return [];
    }

    const notifications = inputs.map((input) =>
      this.notificationRepository.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? null,
        isRead: false,
      }),
    );

    const saved = await this.notificationRepository.save(notifications);
    await Promise.all(saved.map((item) => this.enqueueEmail(item)));
    return saved;
  }

  private async enqueueEmail(notification: Notification) {
    try {
      await this.notificationEmailQueue.add(
        'send',
        {
          notificationId: notification.id,
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue notification email ${notification.id}: ${error?.message || error}`,
      );
    }
  }

  async listForUser(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.notificationRepository.findAndCount({
      where: {
        userId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return {
      items,
      total,
      page,
      limit,
      unreadCount,
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepository.save(notification);
    }

    return {
      message: 'Notification marked as read',
      notification,
    };
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );

    return { message: 'All notifications marked as read' };
  }
}
