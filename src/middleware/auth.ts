import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types';
import { getBearerToken } from '../utils/bearerToken';
import { UnauthorizedError } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = getBearerToken(req);
  if (!token) {
    return next(
      new UnauthorizedError(
        'Please log in to continue',
        'authenticate: missing or malformed Authorization header (expected Bearer token)'
      )
    );
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return next(
      new UnauthorizedError(
        'Your session is invalid or has expired. Please log in again',
        `authenticate: access token verification failed — ${detail}`
      )
    );
  }
}
