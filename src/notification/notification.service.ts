import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../entities/notification.entity';
import { ListNotificationsQueryDto } from './dto/notification.dto';

/**
 * Shared notification API used by community (this branch) and marketplace
 * work on main. Keep create/list/markRead signatures stable when merging.
 * Email queue (BullMQ) lives on main — wire it back on merge if present.
 */
export type CreateNotificationInput = {
  userId: string;
  type: NotificationType | string;
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
  ) {}

  async create(input: CreateNotificationInput) {
    if (!input.userId) {
      return null;
    }

    const notification = this.notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? null,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);
    this.logger.debug(
      `Notification created type=${saved.type} user=${saved.userId}`,
    );
    return saved;
  }

  async createMany(inputs: CreateNotificationInput[]) {
    const valid = inputs.filter((input) => input.userId);
    if (valid.length === 0) {
      return [];
    }

    const notifications = valid.map((input) =>
      this.notificationRepository.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? null,
        isRead: false,
      }),
    );

    return this.notificationRepository.save(notifications);
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
