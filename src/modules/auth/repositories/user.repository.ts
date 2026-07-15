import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import {
  CreateUserData,
  IUser,
  mapUserRow,
  UpdateUserData,
  UserRole,
} from '../types/user.types';

type Queryable = Pick<PoolClient, 'query'>;

const USER_PUBLIC_COLUMNS = `
  id, name, email, mobile_number, wallet_balance, reward_points,
  role, is_active, is_verified, created_at, updated_at
`;

const USER_COLUMNS_WITH_PASSWORD = `
  id, name, email, mobile_number, password_hash, wallet_balance, reward_points,
  role, is_active, is_verified, created_at, updated_at
`;

function mapOptionalRow(row: UserRow | undefined): IUser | null {
  return row ? mapUserRow(row) : null;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  mobile_number: string | null;
  password_hash?: string | null;
  wallet_balance: string | number;
  reward_points: number;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export const userRepository = {
  findById: async (
    id: string,
    options?: {
      includePassword?: boolean;
      client?: Queryable;
    }
  ): Promise<IUser | null> => {
    const db = options?.client ?? pool;
    const columns = options?.includePassword
      ? USER_COLUMNS_WITH_PASSWORD
      : USER_PUBLIC_COLUMNS;
    const result = await db.query<UserRow>(
      `SELECT ${columns} FROM users WHERE id = $1`,
      [id]
    );
    return mapOptionalRow(result.rows[0]);
  },

  findByEmail: async (
    email: string,
    options?: { includePassword?: boolean }
  ): Promise<IUser | null> => {
    const columns = options?.includePassword
      ? USER_COLUMNS_WITH_PASSWORD
      : USER_PUBLIC_COLUMNS;
    const result = await pool.query<UserRow>(
      `SELECT ${columns} FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return mapOptionalRow(result.rows[0]);
  },

  findByMobile: async (
    mobileNumber: string,
    options?: { includePassword?: boolean }
  ): Promise<IUser | null> => {
    const columns = options?.includePassword
      ? USER_COLUMNS_WITH_PASSWORD
      : USER_PUBLIC_COLUMNS;
    const result = await pool.query<UserRow>(
      `SELECT ${columns} FROM users WHERE mobile_number = $1`,
      [mobileNumber]
    );
    return mapOptionalRow(result.rows[0]);
  },

  create: async (data: CreateUserData): Promise<IUser> => {
    const result = await pool.query<UserRow>(
      `INSERT INTO users
         (name, email, mobile_number, password_hash, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      [
        data.name ?? null,
        data.email?.toLowerCase() ?? null,
        data.mobileNumber ?? null,
        data.password ?? null,
        data.role ?? UserRole.USER,
        data.isVerified ?? false,
      ]
    );
    return mapUserRow(result.rows[0]);
  },

  update: async (id: string, data: UpdateUserData): Promise<IUser | null> => {
    const sets: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.email !== undefined) {
      sets.push(`email = $${paramIndex++}`);
      values.push(data.email?.toLowerCase() ?? null);
    }
    if (data.mobileNumber !== undefined) {
      sets.push(`mobile_number = $${paramIndex++}`);
      values.push(data.mobileNumber ?? null);
    }
    if (data.password !== undefined) {
      sets.push(`password_hash = $${paramIndex++}`);
      values.push(data.password);
    }
    if (data.role !== undefined) {
      sets.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.isActive !== undefined) {
      sets.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }
    if (data.isVerified !== undefined) {
      sets.push(`is_verified = $${paramIndex++}`);
      values.push(data.isVerified);
    }

    if (sets.length === 0) {
      return userRepository.findById(id);
    }

    const result = await pool.query<UserRow>(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      values
    );
    return mapOptionalRow(result.rows[0]);
  },

  markVerified: async (id: string): Promise<IUser | null> => {
    const result = await pool.query<UserRow>(
      `UPDATE users
       SET is_verified = true, updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      [id]
    );
    return mapOptionalRow(result.rows[0]);
  },

  updatePassword: async (id: string, password: string): Promise<void> => {
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [id, password]
    );
  },

  countAdmins: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users
       WHERE role IN ($1, $2)`,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  countUsersByRole: async (role: UserRole): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE role = $1`,
      [role]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  updateWalletAndPoints: async (
    id: string,
    walletDelta: number,
    pointsDelta: number,
    client?: Queryable
  ): Promise<IUser | null> => {
    const db = client ?? pool;
    const result = await db.query<UserRow>(
      `UPDATE users
       SET wallet_balance = wallet_balance + $2,
           reward_points = reward_points + $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      [id, walletDelta, pointsDelta]
    );
    return mapOptionalRow(result.rows[0]);
  },
};
