import pool from '../../../database/connection';

export type DevicePlatform = 'ios' | 'android' | 'web' | 'unknown';

export interface IUserDeviceToken {
  _id: string;
  userId: string;
  deviceToken: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface DeviceTokenRow {
  id: string;
  user_id: string;
  device_token: string;
  platform: DevicePlatform;
  device_id: string | null;
  device_name: string | null;
  app_version: string | null;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: DeviceTokenRow): IUserDeviceToken {
  return {
    _id: row.id,
    userId: row.user_id,
    deviceToken: row.device_token,
    platform: row.platform,
    deviceId: row.device_id ?? undefined,
    deviceName: row.device_name ?? undefined,
    appVersion: row.app_version ?? undefined,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `
  id, user_id, device_token, platform, device_id, device_name, app_version,
  is_active, last_used_at, created_at, updated_at
`;

export const userDeviceTokenRepository = {
  upsert: async (data: {
    userId: string;
    deviceToken: string;
    platform?: DevicePlatform;
    deviceId?: string;
    deviceName?: string;
    appVersion?: string;
  }): Promise<IUserDeviceToken> => {
    const result = await pool.query<DeviceTokenRow>(
      `INSERT INTO user_device_tokens (
         user_id, device_token, platform, device_id, device_name, app_version,
         is_active, last_used_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW(), NOW())
       ON CONFLICT (user_id, device_token)
       DO UPDATE SET
         platform = EXCLUDED.platform,
         device_id = COALESCE(EXCLUDED.device_id, user_device_tokens.device_id),
         device_name = COALESCE(EXCLUDED.device_name, user_device_tokens.device_name),
         app_version = COALESCE(EXCLUDED.app_version, user_device_tokens.app_version),
         is_active = true,
         last_used_at = NOW(),
         updated_at = NOW()
       RETURNING ${COLUMNS}`,
      [
        data.userId,
        data.deviceToken,
        data.platform ?? 'unknown',
        data.deviceId ?? null,
        data.deviceName ?? null,
        data.appVersion ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  },

  findActiveByUserAndToken: async (
    userId: string,
    deviceToken: string
  ): Promise<IUserDeviceToken | null> => {
    const result = await pool.query<DeviceTokenRow>(
      `SELECT ${COLUMNS}
       FROM user_device_tokens
       WHERE user_id = $1
         AND device_token = $2
         AND is_active = true
       LIMIT 1`,
      [userId, deviceToken]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  findActiveByUserId: async (userId: string): Promise<IUserDeviceToken[]> => {
    const result = await pool.query<DeviceTokenRow>(
      `SELECT ${COLUMNS}
       FROM user_device_tokens
       WHERE user_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(mapRow);
  },

  touch: async (id: string): Promise<void> => {
    await pool.query(
      `UPDATE user_device_tokens
       SET last_used_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },

  deactivate: async (id: string): Promise<IUserDeviceToken | null> => {
    const result = await pool.query<DeviceTokenRow>(
      `UPDATE user_device_tokens
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  deactivateByUserAndToken: async (
    userId: string,
    deviceToken: string
  ): Promise<IUserDeviceToken | null> => {
    const result = await pool.query<DeviceTokenRow>(
      `UPDATE user_device_tokens
       SET is_active = false, updated_at = NOW()
       WHERE user_id = $1
         AND device_token = $2
         AND is_active = true
       RETURNING ${COLUMNS}`,
      [userId, deviceToken]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  deactivateManyByUserId: async (userId: string): Promise<IUserDeviceToken[]> => {
    const result = await pool.query<DeviceTokenRow>(
      `UPDATE user_device_tokens
       SET is_active = false, updated_at = NOW()
       WHERE user_id = $1 AND is_active = true
       RETURNING ${COLUMNS}`,
      [userId]
    );
    return result.rows.map(mapRow);
  },
};
