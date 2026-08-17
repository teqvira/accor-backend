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

export interface DeviceContext {
  deviceToken: string;
  platform?: 'ios' | 'android' | 'web' | 'unknown';
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}

export interface AuthRequest extends Request {
  user?: JwtAccessPayload;
  bearerToken?: string;
  /** FCM / device metadata from X-Device-* headers or body (see captureDeviceContext). */
  deviceContext?: DeviceContext;
}

export interface AdminProfileResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  mobileNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateAdminProfileInput {
  name?: string;
  avatarUrl?: string | null;
}

