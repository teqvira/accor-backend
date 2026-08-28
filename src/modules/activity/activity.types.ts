export type ActivityKind =
  | 'qr_redemption'
  | 'withdrawal'
  | 'withdrawal_refund'
  | 'reward_redeem'
  | 'wallet_adjustment'
  | 'reward_adjustment';

export type ActivityScope = 'all' | 'wallet' | 'rewards';

export type ActivityStatus =
  | 'success'
  | 'pending'
  | 'processing'
  | 'failed';

export type ActivityDirection = 'credit' | 'debit';

export interface IActivityWalletImpact {
  amount: number;
  direction: ActivityDirection;
}

export interface IActivityRewardImpact {
  points: number;
  direction: ActivityDirection;
}

export interface IActivityProduct {
  id: string;
  name: string;
  skuCode: string;
  imageUrl?: string;
  color?: string;
}

export interface IActivityBatch {
  id: string;
  name: string;
  couponName?: string;
}

export interface IActivityWithdrawal {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  method: 'upi' | 'bank';
  payoutDestination: string;
  failureReason?: string;
  processedAt?: Date;
}

export interface IActivityRewardItem {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface IActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string | null;
  status: ActivityStatus;
  occurredAt: Date;
  wallet: IActivityWalletImpact | null;
  reward: IActivityRewardImpact | null;
  product: IActivityProduct | null;
  batch: IActivityBatch | null;
  withdrawal: IActivityWithdrawal | null;
  rewardItem: IActivityRewardItem | null;
  remarks: string | null;
}

export interface ActivityFeedResult {
  items: IActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityFeedQuery {
  userId: string;
  page?: number;
  limit?: number;
  scope?: ActivityScope;
}

export interface ActivityFeedRow {
  kind: ActivityKind;
  id: string;
  occurred_at: Date;
  wallet_amount: string | number | null;
  wallet_direction: ActivityDirection | null;
  reward_points: number | null;
  reward_direction: ActivityDirection | null;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_image_url: string | null;
  product_color: string | null;
  batch_id: string | null;
  batch_name: string | null;
  batch_coupon_name: string | null;
  qr_code: string | null;
  withdrawal_id: string | null;
  withdrawal_status: string | null;
  account_type: string | null;
  upi_id: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  failure_reason: string | null;
  processed_at: Date | null;
  reward_item_id: string | null;
  reward_item_name: string | null;
  reward_item_image_url: string | null;
  redemption_status: string | null;
  remarks: string | null;
}
