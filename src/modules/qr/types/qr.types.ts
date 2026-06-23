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
  campaignId?: string;
  status: QrBatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQrCode {
  _id: string;
  code: string;
  batchId: string;
  campaignId?: string;
  redeemed: boolean;
  redeemedBy?: string;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBatchInput {
  name: string;
  totalQrs: number;
  campaignId: string;
}

export interface AssignCampaignInput {
  campaignId: string;
}

export interface QrCodeListFilters {
  batchId?: string;
  redeemed?: boolean;
}
