import { Request } from 'express';
import { UserRole } from '../models/User';

export interface JwtAccessPayload {
  sub: string;
  email: string;
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/** Error payload — `message` is user-facing; `developerMessage` is for debugging */
export interface ApiErrorResponse {
  success: false;
  message: string;
  developerMessage: string;
  errors?: Record<string, string[] | undefined>;
}
