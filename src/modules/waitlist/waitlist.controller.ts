import { Request, Response, NextFunction } from 'express';
import { waitlistService } from './waitlist.service';

export class WaitlistController {
  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await waitlistService.joinWaitlist(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: entry });
    } catch (err) { next(err); }
  }

  async myWaitlists(req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await waitlistService.getUserWaitlists(req.user!.userId);
      res.json({ success: true, data: entries });
    } catch (err) { next(err); }
  }

  async slotWaitlist(req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await waitlistService.getSlotWaitlist(req.params.timeSlotId as string);
      res.json({ success: true, data: entries });
    } catch (err) { next(err); }
  }
}

export const waitlistController = new WaitlistController();
