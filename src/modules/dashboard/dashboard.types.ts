export interface DashboardSummary {
  /** Approved + active partners (card: Total Partners / Active Partners). */
  totalPartners: number;
  /** Partners awaiting approval (card: Pending Approvals). */
  pendingApprovals: number;
  /** All-time QR codes generated. */
  totalQrGenerated: number;
  /** All-time ₹ credited to wallets (Reward Amount Distributed). */
  rewardAmountDistributed: number;
  /** All-time reward points credited (Reward Point Issued). */
  rewardPointsIssued: number;
}

export interface DashboardPartnerRequest {
  id: string;
  name: string | null;
  mobileNumber: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  userType: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface DashboardPartnerRequests {
  items: DashboardPartnerRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ScanDistributionItem {
  productId: string;
  productName: string;
  scanCount: number;
  /** Share of totalScans, 0–100 (1 decimal). */
  percentage: number;
}

export interface DashboardScanDistribution {
  totalScans: number;
  items: ScanDistributionItem[];
}

export interface DashboardOverview {
  summary: DashboardSummary;
  partnerRequests: DashboardPartnerRequests;
  scanDistribution: DashboardScanDistribution;
}

/** @deprecated Kept for older clients; prefer DashboardOverview. */
export interface DashboardCards {
  totalUsers: number;
  totalAdmins: number;
  totalProducts: number;
  activeProducts: number;
  totalBatches: number;
  totalQrCodes: number;
  redeemedQrCodes: number;
  unredeemedQrCodes: number;
  totalRedemptions: number;
  totalWalletCredits: number;
  totalRewardCredits: number;
  pendingWithdrawals: number;
  successfulWithdrawals: number;
}

export interface DateCountPoint {
  date: string;
  count: number;
}

export interface LabeledCount {
  label: string;
  count: number;
}

export interface DashboardCharts {
  redemptionsOverTime: DateCountPoint[];
  newUsersOverTime: DateCountPoint[];
  qrStatus: {
    redeemed: number;
    unredeemed: number;
  };
  productsByType: LabeledCount[];
  withdrawalsByStatus: LabeledCount[];
}

export interface DashboardStats {
  cards: DashboardCards;
  charts: DashboardCharts;
}
