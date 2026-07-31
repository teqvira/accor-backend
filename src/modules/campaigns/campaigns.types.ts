export enum CampaignStatus {
  ACTIVE = 'active',
  UPCOMING = 'upcoming',
  EXPIRED = 'expired',
  INACTIVE = 'inactive',
}

export interface ICampaign {
  _id: string;
  campaignCode: string;
  name: string;
  productId: string;
  multiplier: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  status: CampaignStatus;
  batchIds: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: string;
    skuCode: string;
    name: string;
    brand?: string;
  };
  batches?: Array<{
    id: string;
    name: string;
    couponName?: string;
    walletAmount: number;
    rewardPoints: number;
  }>;
}

export interface CreateCampaignInput {
  name: string;
  campaignCode?: string;
  productId: string;
  multiplier: number;
  startDate: string;
  endDate: string;
  batchIds: string[];
  active?: boolean;
}

export interface UpdateCampaignInput {
  name?: string;
  campaignCode?: string;
  productId?: string;
  multiplier?: number;
  startDate?: string;
  endDate?: string;
  batchIds?: string[];
  active?: boolean;
}

export interface CampaignFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  status?: CampaignStatus;
  active?: boolean;
}

export interface ActiveCampaignMultiplier {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  multiplier: number;
}
