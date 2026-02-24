import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[source]);
    // Express 5: req.query and req.params are read-only, attach parsed data differently
    if (source === 'body') {
      req.body = parsed;
    } else {
      // Store validated data on req for consumption by controllers
      (req as any).validated = { ...(req as any).validated, [source]: parsed };
    }
    next();
  };
}
