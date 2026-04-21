/**
 * asyncHandler - lightweight wrapper that funnels async route errors into
 * the global Express error middleware (`secureErrorHandler` in
 * `server/middleware/error-security.ts`).
 *
 * The wrapper does NOT format the response or decide the status code itself
 * — it only catches thrown errors, attaches the route-specific generic
 * error message / log prefix to `res.locals`, and forwards to `next(err)`.
 * That keeps all status-code mapping, logging, and JSON shape decisions in
 * a single place (the global error middleware).
 *
 * Usage:
 *   app.get('/api/things', requireAuth, asyncHandler(async (req, res) => {
 *     const things = await db.select()...;
 *     res.json(things);
 *   }, { errorMessage: 'Failed to fetch things', errorLogPrefix: 'Error fetching things' }));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface AsyncHandlerOptions {
  /**
   * Generic message used in the JSON body when the handler throws an
   * unexpected (non-status-bearing) error. Stored on `res.locals` so the
   * global error middleware can pick it up.
   */
  errorMessage?: string;
  /**
   * Prefix used in the development log line for an unexpected error.
   * Stored on `res.locals` so the global error middleware can preserve the
   * old per-route log shape (`❌ <prefix>: <error>`).
   */
  errorLogPrefix?: string;
  /**
   * Additional static fields to merge into the 500 JSON response body so
   * routes can preserve their historical payload shape (e.g.
   * `{ message, error: 'Internal server error' }`). Keys here are merged
   * before `message` so the per-route message always wins.
   */
  extraErrorFields?: Record<string, unknown>;
}

export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<any> | any,
  options: AsyncHandlerOptions = {}
): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req as unknown as Req, res, next);
    } catch (error) {
      if (options.errorMessage) {
        res.locals.errorMessage = options.errorMessage;
      }
      if (options.errorLogPrefix) {
        res.locals.errorLogPrefix = options.errorLogPrefix;
      }
      if (options.extraErrorFields) {
        res.locals.errorExtraFields = options.extraErrorFields;
      }
      next(error);
    }
  };
}
