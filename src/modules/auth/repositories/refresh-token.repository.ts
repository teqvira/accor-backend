import pool from '../../../database/connection';

export interface IRefreshToken {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

function mapRefreshTokenRow(row: RefreshTokenRow): IRefreshToken {
  return {
    _id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export const refreshTokenRepository = {
  create: async (data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<IRefreshToken> => {
    const result = await pool.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token_hash, expires_at, created_at`,
      [data.userId, data.tokenHash, data.expiresAt]
    );
    return mapRefreshTokenRow(result.rows[0]);
  },

  findByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<IRefreshToken | null> => {
    const result = await pool.query<RefreshTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, created_at
       FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2`,
      [userId, tokenHash]
    );
    return result.rows[0] ? mapRefreshTokenRow(result.rows[0]) : null;
  },

  deleteById: async (id: string): Promise<void> => {
    await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [id]);
  },

  deleteByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<void> => {
    await pool.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2`,
      [userId, tokenHash]
    );
  },

  deleteManyByUserId: async (userId: string): Promise<void> => {
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
  },
};
