export interface IRedemptionTransaction {
  _id: string;
  userId: string;
  qrCodeId: string;
  productId: string;
  walletAmount: number;
  rewardPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRedemptionTransactionData {
  userId: string;
  qrCodeId: string;
  productId: string;
  walletAmount: number;
  rewardPoints: number;
}
