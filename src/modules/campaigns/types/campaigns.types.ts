export interface ICampaign {
  _id: string;
  name: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
