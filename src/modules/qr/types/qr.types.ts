export enum QrBatchStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
}

export type CouponDisplayStatus = 'active' | 'expired' | 'inactive' | 'draft';

export interface IQrBatch {
  _id: string;
  name: string;
  totalQrs: number;
  generatedCount: number;
  productId?: string;
  description?: string;
  walletAmount: number;
  rewardPoints: number;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  status: QrBatchStatus;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: string;
    skuCode: string;
    name: string;
    imageUrl?: string;
  };
  stats?: {
    generated: number;
    redeemed: number;
    pending: number;
  };
}

export interface IQrCode {
  _id: string;
  code: string;
  batchId: string;
  productId?: string;
  redeemed: boolean;
  redeemedBy?: string;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBatchInput {
  productId: string;
  totalQrs: number;
  description?: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: string;
  endDate: string;
  status?: 'active' | 'inactive';
}

export interface QrCodeListFilters {
  batchId?: string;
  redeemed?: boolean;
}

export interface QrBatchListItem {
  batchId: string;
  batchName: string;
  productName: string;
  productSku: string;
  productImageUrl?: string;
  description?: string;
  generated: number;
  redeemed: number;
  pending: number;
  pdfExportUrl: string;
  couponStatus: CouponDisplayStatus;
  totalQrs: number;
  walletAmount: number;
  rewardPoints: number;
  startDate?: string;
  endDate?: string;
  createdAt: Date;
  updatedAt: Date;
}
