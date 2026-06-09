export interface CreateCampaignInput {
  name: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: string;
  endDate: string;
}

export interface UpdateCampaignInput {
  name?: string;
  walletAmount?: number;
  rewardPoints?: number;
  startDate?: string;
  endDate?: string;
}
