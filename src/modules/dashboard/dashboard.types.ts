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
