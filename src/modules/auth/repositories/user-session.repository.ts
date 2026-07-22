import pool from '../../../database/connection';

export interface IUserSession {
  _id: string;
  userId: string;
  refreshTokenId?: string;
  deviceTokenId?: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  loggedOutAt?: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_id: string | null;
  device_token_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  logged_out_at: Date | null;
}

function mapRow(row: SessionRow): IUserSession {
  return {
    _id: row.id,
    userId: row.user_id,
    refreshTokenId: row.refresh_token_id ?? undefined,
    deviceTokenId: row.device_token_id ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    loggedOutAt: row.logged_out_at ?? undefined,
  };
}

const COLUMNS = `
  id, user_id, refresh_token_id, device_token_id, ip_address, user_agent,
  is_active, created_at, updated_at, logged_out_at
`;

export const userSessionRepository = {
  create: async (data: {
    userId: string;
    refreshTokenId?: string;
    deviceTokenId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IUserSession> => {
    const result = await pool.query<SessionRow>(
      `INSERT INTO user_sessions (
         user_id, refresh_token_id, device_token_id, ip_address, user_agent
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [
        data.userId,
        data.refreshTokenId ?? null,
        data.deviceTokenId ?? null,
        data.ipAddress ?? null,
        data.userAgent ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  },

  findActiveByRefreshTokenId: async (
    refreshTokenId: string
  ): Promise<IUserSession | null> => {
    const result = await pool.query<SessionRow>(
      `SELECT ${COLUMNS}
       FROM user_sessions
       WHERE refresh_token_id = $1 AND is_active = true
       LIMIT 1`,
      [refreshTokenId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  touchByRefreshTokenId: async (
    refreshTokenId: string,
    newRefreshTokenId?: string
  ): Promise<void> => {
    if (newRefreshTokenId) {
      await pool.query(
        `UPDATE user_sessions
         SET refresh_token_id = $2,
             updated_at = NOW()
         WHERE refresh_token_id = $1 AND is_active = true`,
        [refreshTokenId, newRefreshTokenId]
      );
      return;
    }

    await pool.query(
      `UPDATE user_sessions
       SET updated_at = NOW()
       WHERE refresh_token_id = $1 AND is_active = true`,
      [refreshTokenId]
    );
  },

  closeByRefreshTokenId: async (refreshTokenId: string): Promise<IUserSession | null> => {
    const result = await pool.query<SessionRow>(
      `UPDATE user_sessions
       SET is_active = false,
           logged_out_at = NOW(),
           updated_at = NOW()
       WHERE refresh_token_id = $1 AND is_active = true
       RETURNING ${COLUMNS}`,
      [refreshTokenId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  closeManyByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query(
      `UPDATE user_sessions
       SET is_active = false,
           logged_out_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    return result.rowCount ?? 0;
  },

  findActiveByUserId: async (userId: string): Promise<IUserSession[]> => {
    const result = await pool.query<SessionRow>(
      `SELECT ${COLUMNS}
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(mapRow);
  },
};
