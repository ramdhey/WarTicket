import { Request, Response, NextFunction } from 'express';
import { eventService } from './event.service';
import { getFileUrl } from '../../middlewares/upload';
import { eventQuerySchema } from './event.schema';
import prisma from '../../lib/prisma';

export class EventController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = (req as any).validated || req.body;
      console.log('Incoming Event Data:', input, !!req.files);
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files['image']?.[0]) input.imageUrl = getFileUrl(req, files['image'][0]);
        if (files['banner']?.[0]) input.bannerUrl = getFileUrl(req, files['banner'][0]);
      }
      const event = await eventService.create(req.user!.userId, input);
      res.status(201).json({ success: true, data: event });
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = (req as any).validated || req.body;
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files['image']?.[0]) input.imageUrl = getFileUrl(req, files['image'][0]);
        if (files['banner']?.[0]) input.bannerUrl = getFileUrl(req, files['banner'][0]);
      }
      const event = await eventService.update(
        req.user!.userId, req.user!.role, req.params.id as string, input,
      );
      res.json({ success: true, data: event });
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await eventService.delete(req.user!.userId, req.user!.role, req.params.id as string);
      res.json({ success: true, message: 'Event deleted' });
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventService.getById(req.params.id as string);
      res.json({ success: true, data: event });
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = eventQuerySchema.parse(req.query);
      // If user is logged in, fetch preferences for smart sort
      let userPreferences: string[] | undefined;
      if (req.user && query.sort === 'smart') {
        const user = await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { preferences: true },
        });
        userPreferences = user?.preferences;
      }
      const result = await eventService.list(query, userPreferences);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}

export const eventController = new EventController();
