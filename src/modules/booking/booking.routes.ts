import { Router } from 'express';
import { bookingController } from './booking.controller';
import { validate } from '../../middlewares/validate';
import { createBookingSchema, cancelBookingSchema, partialCancelSchema } from './booking.schema';
import { authMiddleware } from '../../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.post('/', validate(createBookingSchema), (req, res, next) => bookingController.createDirect(req, res, next));
router.get('/me', (req, res, next) => bookingController.myBookings(req, res, next));
router.delete('/:id', validate(cancelBookingSchema, 'params'), (req, res, next) => bookingController.cancel(req, res, next));
router.patch('/:id/reduce', validate(partialCancelSchema), (req, res, next) => bookingController.partialCancel(req, res, next));
router.post('/:id/undo', (req, res, next) => bookingController.undoCancellation(req, res, next));

export default router;
