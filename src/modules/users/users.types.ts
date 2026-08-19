import { GarageRole, UserRole, UserType } from '../auth/user.types';

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

export interface CompleteProfileInput {
  name: string;
  email: string;
  dateOfBirth: string;
  city: string;
  state: string;
  pincode: string;
  userType: UserType;
  garageRole?: GarageRole;
  garageName?: string;
  garageOwnerName?: string;
  avatarUrl?: string;
  aadhaarUrl: string;
  panUrl: string;
}
