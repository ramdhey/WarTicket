import { Router } from 'express';
import { eventController } from './event.controller';
import { validate } from '../../middlewares/validate';
import { createEventSchema, updateEventSchema, eventQuerySchema } from './event.schema';
import { authMiddleware, optionalAuth } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { upload } from '../../middlewares/upload';

const router = Router();
const eventUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'banner', maxCount: 1 }]);

// Public: browse (optional auth for smart sort)
router.get('/', optionalAuth, (req, res, next) => eventController.list(req, res, next));
router.get('/:id', (req, res, next) => eventController.getById(req, res, next));

// Protected: create/edit/delete
router.post('/', authMiddleware, requireRole('ADMIN'),
  (req, _res, next) => { console.log('[EVENT CREATE] Upload starting, content-length:', req.headers['content-length']); next(); },
  eventUpload,
  (req, _res, next) => { console.log('[EVENT CREATE] Upload done, files:', Object.keys((req.files as any) || {}), 'body keys:', Object.keys(req.body)); next(); },
  validate(createEventSchema),
  (req, res, next) => eventController.create(req, res, next),
);
router.put('/:id', authMiddleware, requireRole('ADMIN'), eventUpload, validate(updateEventSchema), (req, res, next) => eventController.update(req, res, next));
router.delete('/:id', authMiddleware, requireRole('ADMIN'), (req, res, next) => eventController.delete(req, res, next));

export default router;
