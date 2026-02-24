import { Router } from 'express';
import { waitlistController } from './waitlist.controller';
import { validate } from '../../middlewares/validate';
import { joinWaitlistSchema } from './waitlist.schema';
import { authMiddleware } from '../../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(joinWaitlistSchema), (req, res, next) => waitlistController.join(req, res, next));
router.get('/me', (req, res, next) => waitlistController.myWaitlists(req, res, next));
router.get('/slot/:timeSlotId', (req, res, next) => waitlistController.slotWaitlist(req, res, next));

export default router;
