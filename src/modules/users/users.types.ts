import { UserRole } from '../auth/user.types';

export interface UserListFilters {
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string | null;
  mobileNumber?: string | null;
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
}
