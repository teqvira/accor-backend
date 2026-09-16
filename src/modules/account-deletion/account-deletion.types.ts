export type AccountDeletionSource = 'app' | 'website' | 'admin';
export type AccountDeletionStatus = 'pending' | 'completed' | 'cancelled';

export interface IAccountDeletionRequest {
  _id: string;
  userId: string;
  mobileNumber: string;
  source: AccountDeletionSource;
  status: AccountDeletionStatus;
  reason?: string;
  requestedAt: Date;
  scheduledFor?: Date;
  processedAt?: Date;
  cancelledAt?: Date;
  processedBy?: string;
  cancelledBy?: string;
  createdAt: Date;
  updatedAt: Date;
  /** Joined fields for admin list */
  userName?: string;
  userEmail?: string;
  userIsActive?: boolean;
  userDeletedAt?: Date;
}

export interface AccountDeletionListFilters {
  status?: AccountDeletionStatus;
  source?: AccountDeletionSource;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateAccountDeletionRequestData {
  userId: string;
  mobileNumber: string;
  source: AccountDeletionSource;
  status: AccountDeletionStatus;
  reason?: string | null;
  scheduledFor?: Date | null;
  processedAt?: Date | null;
  processedBy?: string | null;
}
