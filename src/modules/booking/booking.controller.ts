import { Request, Response, NextFunction } from 'express';
import { bookingService } from './booking.service';

export class BookingController {
  async createDirect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await bookingService.processBooking(userId, req.body);
      const statusCode = result.status === 'CONFIRMED' ? 201 : 200;
      res.status(statusCode).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.cancelBooking(req.user!.userId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async partialCancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.partialCancel(
        req.user!.userId, req.params.id as string, req.body.cancelQuantity,
      );
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async undoCancellation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.undoCancellation(req.user!.userId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async myBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const bookings = await bookingService.getUserBookings(req.user!.userId);
      res.json({ success: true, data: bookings });
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const booking = await bookingService.getBookingById(req.user!.userId, req.params.id as string);
      res.json({ success: true, data: booking });
    } catch (err) { next(err); }
  }
}

export const bookingController = new BookingController();
