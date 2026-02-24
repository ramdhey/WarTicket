import { Router } from 'express';
import { ticketController } from './ticket.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';

const router = Router();

// Admin only routes
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// GET /admin/tickets/:id/verify — scan barcode, check ticket validity
router.get('/:id/verify', (req, res, next) => ticketController.verify(req, res, next));

// POST /admin/tickets/:id/checkin — mark ticket as checked in
router.post('/:id/checkin', (req, res, next) => ticketController.checkIn(req, res, next));

export default router;
