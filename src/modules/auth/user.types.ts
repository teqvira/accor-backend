export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export type UserType = 'mechanic' | 'dealer';

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
  avatarUrl?: string;
  dateOfBirth?: Date;
  city?: string;
  state?: string;
  userType?: UserType;
  profileCompleted: boolean;
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
  avatar_url?: string | null;
  date_of_birth?: Date | string | null;
  city?: string | null;
  state?: string | null;
  user_type?: string | null;
  profile_completed?: boolean | null;
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
    avatarUrl: row.avatar_url ?? undefined,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    userType: (row.user_type as UserType | null) ?? undefined,
    profileCompleted: Boolean(row.profile_completed),
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
  email?: string | null;
  mobileNumber?: string | null;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  city?: string | null;
  state?: string | null;
  userType?: UserType | null;
  profileCompleted?: boolean;
}
