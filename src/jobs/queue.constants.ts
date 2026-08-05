export const NOTIFICATION_EMAIL_QUEUE = 'notification-emails';

export type NotificationEmailJob = {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
};
