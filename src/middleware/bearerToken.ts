import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types';
import { BadRequestError } from '../utils/errors';
import { getBearerToken } from '../utils/bearerToken';

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
