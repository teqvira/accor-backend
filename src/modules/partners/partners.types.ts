import { ApprovalStatus, UserType } from '../auth/user.types';
import { PartnerListItem } from '../auth/repositories/user.repository';

export interface PartnerListFilters {
  userType?: UserType;
  approvalStatus?: ApprovalStatus;
  search?: string;
}

export interface CreatePartnerInput {
  name: string;
  mobileNumber: string;
  userType: UserType;
  email: string;
  city?: string;
  state?: string;
  aadhaarUrl: string;
  panUrl: string;
}

export interface UpdatePartnerDocumentsInput {
  aadhaarUrl?: string;
  panUrl?: string;
}

export function sanitizePartner(item: PartnerListItem) {
  return {
    id: item._id,
    name: item.name ?? null,
    mobileNumber: item.mobileNumber ?? null,
    email: item.email ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    pincode: item.pincode ?? null,
    userType: item.userType ?? null,
    garageRole: item.garageRole ?? null,
    garageName: item.garageName ?? null,
    garageOwnerName: item.garageOwnerName ?? null,
    approvalStatus: item.approvalStatus,
    isActive: item.isActive,
    isVerified: item.isVerified,
    profileCompleted: item.profileCompleted,
    avatarUrl: item.avatarUrl ?? null,
    walletBalance: item.walletBalance,
    rewardPoints: item.rewardPoints,
    qrScanCount: item.qrScanCount,
    rewardsEarned: item.rewardsEarned,
    cashRedeemed: item.cashRedeemed,
    documents: item.documents,
    joinedOn: item.createdAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
