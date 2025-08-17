/**
 * Request validation middleware using Zod schemas.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 *
 * @param schema
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ 
        message: 'Validation error', 
        code: 'VALIDATION_ERROR',
        details: error
      });
    }
  };
}

/**
 *
 * @param schema
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      res.status(400).json({ 
        message: 'Query validation error', 
        code: 'QUERY_VALIDATION_ERROR',
        details: error
      });
    }
  };
}