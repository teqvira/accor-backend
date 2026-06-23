import { NextFunction, Response } from 'express';
import { getBearerToken } from '../../../shared/utils/bearerToken';
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '../../../shared/utils/errors';
import { AuthRequest } from '../types/auth.types';
import { UserRole } from '../types/user.types';
import { verifyAccessToken } from '../utils/jwt.util';

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

export function optionalAuthenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = getBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Ignore invalid tokens on public OTP routes.
  }
  next();
}

export function requireBearerToken(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = getBearerToken(req);
  if (!token) {
    return next(
      new BadRequestError(
        'Refresh token is required',
        'requireBearerToken: missing or malformed Authorization header (expected Bearer <token>)'
      )
    );
  }
  req.bearerToken = token;
  next();
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new UnauthorizedError(
          'Please log in to continue',
          'requireRoles: req.user is undefined (authenticate middleware may have been skipped)'
        )
      );
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          'You do not have permission to perform this action',
          `requireRoles: role=${req.user.role} not in [${allowedRoles.join(', ')}]`
        )
      );
    }
    next();
  };
}
