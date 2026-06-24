export enum QrBatchStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  ASSIGNED = 'assigned',
}

export interface IQrBatch {
  _id: string;
  name: string;
  totalQrs: number;
  generatedCount: number;
  productId?: string;
  campaignId?: string;
  description?: string;
  status: QrBatchStatus;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: string;
    skuCode: string;
    name: string;
    imageUrl?: string;
  };
}

export interface IQrCode {
  _id: string;
  code: string;
  batchId: string;
  productId?: string;
  campaignId?: string;
  redeemed: boolean;
  redeemedBy?: string;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBatchInput {
  name?: string;
  productId: string;
  campaignId?: string;
  description?: string;
  totalQrs: number;
}

export interface AssignCampaignInput {
  campaignId: string;
}

export interface QrCodeListFilters {
  batchId?: string;
  redeemed?: boolean;
}
