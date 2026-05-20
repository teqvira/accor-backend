import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../../config/env';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
  JwtResetPayload,
} from '../types/auth.types';

function signToken(
  payload: object,
  secret: string,
  expiresIn: string
): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, options);
}

export function signAccessToken(payload: JwtAccessPayload): string {
  return signToken(payload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return signToken(payload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);
}

export function signResetToken(payload: JwtResetPayload): string {
  return signToken(payload, env.JWT_RESET_SECRET, env.JWT_RESET_EXPIRES_IN);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}

export function verifyResetToken(token: string): JwtResetPayload {
  const payload = jwt.verify(token, env.JWT_RESET_SECRET) as JwtResetPayload;
  if (payload.purpose !== 'password-reset') {
    throw new Error('Invalid reset token');
  }
  return payload;
}
