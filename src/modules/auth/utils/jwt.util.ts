import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../../config/env';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
  JwtResetPayload,
} from '../types/auth.types';

function signToken(
  payload: JwtAccessPayload | JwtRefreshPayload | JwtResetPayload,
  secret: string,
  expiresIn: string
): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, secret, options);
}

function assertJwtObject(
  decoded: jwt.JwtPayload | string | undefined,
  label: string
): jwt.JwtPayload {
  if (!decoded || typeof decoded === 'string') {
    throw new Error(`Invalid ${label} token payload`);
  }
  return decoded;
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
  const decoded = assertJwtObject(
    jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload | string,
    'access'
  );

  if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
    throw new Error('Invalid access token payload');
  }

  return {
    sub: decoded.sub,
    email: typeof decoded.email === 'string' ? decoded.email : undefined,
    mobileNumber:
      typeof decoded.mobileNumber === 'string' ? decoded.mobileNumber : undefined,
    role: decoded.role as JwtAccessPayload['role'],
  };
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  const decoded = assertJwtObject(
    jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload | string,
    'refresh'
  );

  if (typeof decoded.sub !== 'string' || typeof decoded.tokenId !== 'string') {
    throw new Error('Invalid refresh token payload');
  }

  return {
    sub: decoded.sub,
    tokenId: decoded.tokenId,
  };
}

export function verifyResetToken(token: string): JwtResetPayload {
  const decoded = assertJwtObject(
    jwt.verify(token, env.JWT_RESET_SECRET) as jwt.JwtPayload | string,
    'reset'
  );

  if (typeof decoded.sub !== 'string' || decoded.purpose !== 'password-reset') {
    throw new Error('Invalid reset token');
  }

  return {
    sub: decoded.sub,
    purpose: 'password-reset',
  };
}
