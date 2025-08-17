/**
 * CORS middleware configuration.
 */
import { Request, Response, NextFunction } from 'express';

/**
 *
 * @param req
 * @param res
 * @param next
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}