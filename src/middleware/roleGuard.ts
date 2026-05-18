import { NextFunction, Response } from 'express';
import { UserRole } from '../models/User';
import { AuthRequest } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

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
