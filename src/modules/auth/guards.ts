import { authenticate, requireRoles } from './auth.middleware';
import { UserRole } from './user.types';

export const userOnly = [authenticate, requireRoles(UserRole.USER)];

export const adminOnly = [
  authenticate,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
];
