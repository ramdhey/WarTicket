import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'body') {
        req.body = parsed;
      } else {
        (req as any).validated = { ...(req as any).validated, [source]: parsed };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
