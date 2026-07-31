export interface IRedemptionTransaction {
  _id: string;
  userId: string;
  qrCodeId: string;
  batchId: string;
  productId: string;
  walletAmount: number;
  rewardPoints: number;
  campaignId?: string;
  multiplierApplied?: number;
  redeemedAt: Date;
  createdAt: Date;
}

export interface CreateRedemptionTransactionData {
  userId: string;
  qrCodeId: string;
  batchId: string;
  productId: string;
  walletAmount: number;
  rewardPoints: number;
  campaignId?: string;
  multiplierApplied?: number;
  redeemedAt?: Date;
}

