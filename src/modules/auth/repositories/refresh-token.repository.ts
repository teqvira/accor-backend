import pool from '../../../database/connection';

export interface IRefreshToken {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

function mapRefreshTokenRow(row: RefreshTokenRow): IRefreshToken {
  return {
    _id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };
}

const TOKEN_COLUMNS = `
  id, user_id, token_hash, expires_at, revoked, created_at
`;

export const refreshTokenRepository = {
  create: async (data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<IRefreshToken> => {
    const result = await pool.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING ${TOKEN_COLUMNS}`,
      [data.userId, data.tokenHash, data.expiresAt]
    );
    return mapRefreshTokenRow(result.rows[0]);
  },

  findByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<IRefreshToken | null> => {
    const result = await pool.query<RefreshTokenRow>(
      `SELECT ${TOKEN_COLUMNS}
       FROM refresh_tokens
       WHERE user_id = $1
         AND token_hash = $2
         AND revoked = false
         AND expires_at > NOW()`,
      [userId, tokenHash]
    );
    return result.rows[0] ? mapRefreshTokenRow(result.rows[0]) : null;
  },

  revokeById: async (id: string): Promise<void> => {
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
      [id]
    );
  },

  revokeByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<void> => {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked = true
       WHERE user_id = $1 AND token_hash = $2 AND revoked = false`,
      [userId, tokenHash]
    );
  },

  revokeManyByUserId: async (userId: string): Promise<void> => {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked = true
       WHERE user_id = $1 AND revoked = false`,
      [userId]
    );
  },

  // Backward-compatible aliases used by auth.service
  deleteById: async (id: string): Promise<void> => {
    await refreshTokenRepository.revokeById(id);
  },

  deleteByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<void> => {
    await refreshTokenRepository.revokeByUserAndHash(userId, tokenHash);
  },

  deleteManyByUserId: async (userId: string): Promise<void> => {
    await refreshTokenRepository.revokeManyByUserId(userId);
  },
};
