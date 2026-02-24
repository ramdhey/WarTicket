import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const unreadOnly = req.query.unread === 'true';
      const notifications = await notificationService.getUserNotifications(req.user!.userId, unreadOnly);
      const unreadCount = await notificationService.getUnreadCount(req.user!.userId);
      res.json({ success: true, data: { notifications, unreadCount } });
    } catch (err) { next(err); }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.markAsRead(req.params.id as string, req.user!.userId);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) { next(err); }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.markAllAsRead(req.user!.userId);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) { next(err); }
  }
}

export const notificationController = new NotificationController();
