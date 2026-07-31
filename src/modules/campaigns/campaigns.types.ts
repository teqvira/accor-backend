export enum CampaignStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

export interface ICampaign {
  _id: string;
  campaignCode: string;
  name: string;
  productId: string;
  multiplier: number;
  startDate: Date;
  endDate: Date;
  status: CampaignStatus;
  description?: string;
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
  description?: string;
  status?: CampaignStatus;
}

export interface UpdateCampaignInput {
  name?: string;
  campaignCode?: string;
  productId?: string;
  multiplier?: number;
  startDate?: string;
  endDate?: string;
  batchIds?: string[];
  description?: string;
  status?: CampaignStatus;
}

export interface CampaignFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  status?: CampaignStatus;
}

export interface ActiveCampaignMultiplier {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  multiplier: number;
}
