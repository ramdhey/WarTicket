import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, `Access denied. Required role: ${roles.join(' or ')}`, 'FORBIDDEN');
    }
    next();
  };
}
