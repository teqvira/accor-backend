export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export interface IUser {
  _id: string;
  name?: string;
  email?: string;
  password?: string;
  mobileNumber?: string;
  walletBalance: number;
  rewardPoints: number;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export function mapUserRow(row: UserRow): IUser {
  return {
    _id: row.id,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    password: row.password_hash ?? undefined,
    mobileNumber: row.mobile_number ?? undefined,
    walletBalance: Number(row.wallet_balance),
    rewardPoints: row.reward_points,
    role: row.role,
    isActive: row.is_active,
    isVerified: row.is_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateUserData {
  name?: string;
  email?: string;
  mobileNumber?: string;
  password?: string;
  role?: UserRole;
  isVerified?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  mobileNumber?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
}
