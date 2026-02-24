import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.get('/me', (req, res, next) => notificationController.list(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationController.markRead(req, res, next));
router.patch('/read-all', (req, res, next) => notificationController.markAllRead(req, res, next));

export default router;
