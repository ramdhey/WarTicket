import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { getFileUrl } from '../../middlewares/upload';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = (req as any).validated || req.body;
      if (req.file) input.avatarUrl = getFileUrl(req, req.file);
      const result = await authService.register(input);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refreshTokens(req.body.refreshToken);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async profile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.user!.userId);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const input = (req as any).validated || req.body;
      if (req.file) input.avatarUrl = getFileUrl(req, req.file);
      const user = await authService.updateProfile(req.user!.userId, input);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
}

export const authController = new AuthController();
