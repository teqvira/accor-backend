import pool from '../../../database/connection';
import { DevicePlatform } from './user-device-token.repository';

export type InvalidDeviceTokenReason =
  | 'logout'
  | 'revoked'
  | 'replaced'
  | 'expired'
  | 'admin_revoke';

export type InvalidAuthTokenReason =
  | 'logout'
  | 'refresh_rotate'
  | 'password_reset'
  | 'revoked'
  | 'reuse_detected'
  | 'admin_revoke';

export type AuthTokenType = 'access' | 'refresh';

export const invalidTokenRepository = {
  recordInvalidDeviceToken: async (data: {
    userId?: string;
    deviceTokenId?: string;
    deviceToken: string;
    platform?: DevicePlatform | string;
    reason?: InvalidDeviceTokenReason;
    sessionId?: string;
  }): Promise<void> => {
    await pool.query(
      `INSERT INTO invalid_device_tokens (
         user_id, device_token_id, device_token, platform, reason, session_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.userId ?? null,
        data.deviceTokenId ?? null,
        data.deviceToken,
        data.platform ?? null,
        data.reason ?? 'logout',
        data.sessionId ?? null,
      ]
    );
  },

  recordInvalidAuthToken: async (data: {
    userId?: string;
    tokenHash: string;
    tokenType: AuthTokenType;
    reason?: InvalidAuthTokenReason;
    sessionId?: string;
    expiresAt?: Date;
  }): Promise<void> => {
    await pool.query(
      `INSERT INTO invalid_auth_tokens (
         user_id, token_hash, token_type, reason, session_id, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.userId ?? null,
        data.tokenHash,
        data.tokenType,
        data.reason ?? 'logout',
        data.sessionId ?? null,
        data.expiresAt ?? null,
      ]
    );
  },

  isAuthTokenInvalid: async (tokenHash: string): Promise<boolean> => {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM invalid_auth_tokens WHERE token_hash = $1
       ) AS exists`,
      [tokenHash]
    );
    return Boolean(result.rows[0]?.exists);
  },

  isDeviceTokenInvalid: async (deviceToken: string): Promise<boolean> => {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM invalid_device_tokens
         WHERE device_token = $1
         ORDER BY created_at DESC
         LIMIT 1
       ) AS exists`,
      [deviceToken]
    );
    return Boolean(result.rows[0]?.exists);
  },
};
