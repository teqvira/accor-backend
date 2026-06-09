import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

type Schema = z.ZodType;

export function validate(schema: Schema, source: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    req[source] = result.data;
    next();
  };
}
