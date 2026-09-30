import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        next(
          new AppError(
            `Validation failed: ${issues.map((i) => `${i.field} (${i.message})`).join(', ')}`,
            422,
            'VALIDATION_ERROR',
            'Correct the highlighted fields according to schema requirements.',
            issues
          )
        );
      } else {
        next(err);
      }
    }
  };
}
