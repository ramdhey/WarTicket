import { notificationRepository } from './notification.repository';

export class NotificationService {
  async getUserNotifications(userId: string, unreadOnly = false) {
    return notificationRepository.findByUser(userId, unreadOnly);
  }

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  }

  async getUnreadCount(userId: string) {
    return notificationRepository.countUnread(userId);
  }

  async createPromotionNotification(userId: string, eventTitle: string, slotLabel: string) {
    return notificationRepository.create({
      userId,
      type: 'WAITLIST_PROMOTED',
      title: '🎉 You\'ve been promoted from the waitlist!',
      message: `Great news! A spot opened up for "${eventTitle}" (${slotLabel}). Your booking is now confirmed.`,
      metadata: { eventTitle, slotLabel },
    });
  }
}

export const notificationService = new NotificationService();
