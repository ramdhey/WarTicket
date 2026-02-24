import prisma from '../../lib/prisma';

export class NotificationRepository {
  async create(data: { userId: string; type: string; title: string; message: string; metadata?: any }) {
    return prisma.notification.create({ data: data as any });
  }

  async findByUser(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async countUnread(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}

export const notificationRepository = new NotificationRepository();
