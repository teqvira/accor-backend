import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import { withTransaction } from '../../../database/transactions';

export interface IRefreshToken {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  createdAt: Date;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  revoked_at: Date | null;
  created_at: Date;
}

function mapRefreshTokenRow(row: RefreshTokenRow): IRefreshToken {
  return {
    _id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    revokedAt: row.revoked_at ?? undefined,
    createdAt: row.created_at,
  };
}

const TOKEN_COLUMNS = `
  id, user_id, token_hash, expires_at, revoked, revoked_at, created_at
`;

async function createWithClient(
  client: PoolClient,
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }
): Promise<IRefreshToken> {
  const result = await client.query<RefreshTokenRow>(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING ${TOKEN_COLUMNS}`,
    [data.userId, data.tokenHash, data.expiresAt]
  );
  return mapRefreshTokenRow(result.rows[0]);
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
       RETURNING ${TOKEN_COLUMNS}`,
      [data.userId, data.tokenHash, data.expiresAt]
    );
    return mapRefreshTokenRow(result.rows[0]);
  },

  /** Active (not revoked, not expired) token lookup used for normal refresh. */
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

  /** Lookup including blocked/expired rows (for clearer errors). */
  findAnyByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<IRefreshToken | null> => {
    const result = await pool.query<RefreshTokenRow>(
      `SELECT ${TOKEN_COLUMNS}
       FROM refresh_tokens
       WHERE user_id = $1
         AND token_hash = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, tokenHash]
    );
    return result.rows[0] ? mapRefreshTokenRow(result.rows[0]) : null;
  },

  /**
   * Atomically block the old refresh token and store the new one.
   * Old row stays in refresh_tokens with revoked=true (blocked history).
   */
  rotate: async (data: {
    oldTokenId: string;
    userId: string;
    newTokenHash: string;
    newExpiresAt: Date;
  }): Promise<IRefreshToken> => {
    return withTransaction(async (client) => {
      const locked = await client.query<RefreshTokenRow>(
        `SELECT ${TOKEN_COLUMNS}
         FROM refresh_tokens
         WHERE id = $1
         FOR UPDATE`,
        [data.oldTokenId]
      );

      const current = locked.rows[0];
      if (!current) {
        throw new Error('REFRESH_TOKEN_MISSING');
      }
      if (current.revoked) {
        throw new Error('REFRESH_TOKEN_REVOKED');
      }
      if (new Date(current.expires_at) <= new Date()) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }

      await client.query(
        `UPDATE refresh_tokens
         SET revoked = true, revoked_at = NOW()
         WHERE id = $1`,
        [data.oldTokenId]
      );

      return createWithClient(client, {
        userId: data.userId,
        tokenHash: data.newTokenHash,
        expiresAt: data.newExpiresAt,
      });
    });
  },

  revokeById: async (id: string): Promise<void> => {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW()
       WHERE id = $1 AND revoked = false`,
      [id]
    );
  },

  revokeByUserAndHash: async (
    userId: string,
    tokenHash: string
  ): Promise<void> => {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW()
       WHERE user_id = $1 AND token_hash = $2 AND revoked = false`,
      [userId, tokenHash]
    );
  },

  revokeManyByUserId: async (userId: string): Promise<void> => {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW()
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
