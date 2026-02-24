import { Request, Response, NextFunction } from 'express';
import { ticketService } from './ticket.service';

export class TicketController {
  /**
   * Admin scans barcode → verify ticket is valid.
   */
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ticketService.verifyTicket(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /**
   * Admin checks in the ticket → marks as used.
   */
  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ticketService.checkInTicket(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}

export const ticketController = new TicketController();
