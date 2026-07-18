import { Request } from 'express';
import { UserRole } from './user.types';

export interface JwtAccessPayload {
  sub: string;
  email?: string;
  mobileNumber?: string;
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
}

export interface JwtResetPayload {
  sub: string;
  purpose: 'password-reset';
}

export interface AuthRequest extends Request {
  user?: JwtAccessPayload;
  bearerToken?: string;
}
