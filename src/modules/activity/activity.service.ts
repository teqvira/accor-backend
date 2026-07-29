import {
  ActivityFeedQuery,
  ActivityFeedResult,
  ActivityFeedRow,
  ActivityScope,
  ActivityStatus,
  IActivityBatch,
  IActivityItem,
  IActivityProduct,
  IActivityRewardItem,
  IActivityWithdrawal,
} from './activity.types';
import { activityRepository } from './activity.repository';

function maskBankAccount(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '****';
  if (accountNumber.length <= 4) return `****${accountNumber}`;
  return `****${accountNumber.slice(-4)}`;
}

function resolvePayoutDestination(row: ActivityFeedRow): string {
  if (row.account_type === 'upi') {
    return row.upi_id ?? '';
  }
  if (row.account_number || row.ifsc_code) {
    return `${maskBankAccount(row.account_number)}@${row.ifsc_code ?? ''}`;
  }
  return '';
}

function mapWithdrawalStatus(
  status: string | null
): IActivityWithdrawal['status'] | null {
  if (
    status === 'pending' ||
    status === 'processing' ||
    status === 'success' ||
    status === 'failed'
  ) {
    return status;
  }
  return null;
}

function mapFeedStatus(row: ActivityFeedRow): ActivityStatus {
  if (row.kind === 'withdrawal_refund') {
    return 'success';
  }
  if (row.kind === 'withdrawal') {
    const status = mapWithdrawalStatus(row.withdrawal_status);
    if (status === 'pending') return 'pending';
    if (status === 'processing') return 'processing';
    if (status === 'failed') return 'failed';
    return 'success';
  }
  return 'success';
}

function buildTitle(row: ActivityFeedRow): string {
  switch (row.kind) {
    case 'qr_redemption':
      return 'QR Redeemed';
    case 'withdrawal':
      return 'Withdrawal';
    case 'withdrawal_refund':
      return 'Withdrawal Refund';
    case 'reward_redeem':
      return 'Reward Redeemed';
    case 'wallet_adjustment':
      if (row.wallet_direction === 'debit') return 'Wallet Debit';
      return 'Wallet Credit';
    case 'reward_adjustment':
      if (row.reward_direction === 'debit') return 'Points Debit';
      return 'Points Credit';
    default:
      return 'Activity';
  }
}

function buildSubtitle(row: ActivityFeedRow): string | null {
  switch (row.kind) {
    case 'qr_redemption': {
      if (row.product_name && row.product_sku) {
        return `${row.product_name} (SKU: ${row.product_sku})`;
      }
      return row.product_name ?? row.product_sku ?? row.batch_name ?? null;
    }
    case 'withdrawal':
    case 'withdrawal_refund': {
      const destination = resolvePayoutDestination(row);
      if (!destination) return null;
      return row.account_type === 'bank'
        ? `To Bank: ${destination}`
        : `To UPI: ${destination}`;
    }
    case 'reward_redeem':
      return row.reward_item_name ?? row.remarks ?? null;
    case 'wallet_adjustment':
    case 'reward_adjustment':
      return row.remarks ?? null;
    default:
      return null;
  }
}

function mapProduct(row: ActivityFeedRow): IActivityProduct | null {
  if (!row.product_id || !row.product_name || !row.product_sku) {
    return null;
  }
  return {
    id: row.product_id,
    name: row.product_name,
    skuCode: row.product_sku,
    imageUrl: row.product_image_url ?? undefined,
    color: row.product_color ?? undefined,
  };
}

function mapBatch(row: ActivityFeedRow): IActivityBatch | null {
  if (!row.batch_id || !row.batch_name) {
    return null;
  }
  return {
    id: row.batch_id,
    name: row.batch_name,
    couponName: row.batch_coupon_name ?? undefined,
  };
}

function mapWithdrawal(row: ActivityFeedRow): IActivityWithdrawal | null {
  if (!row.withdrawal_id) return null;
  const status = mapWithdrawalStatus(row.withdrawal_status);
  if (!status) return null;

  return {
    id: row.withdrawal_id,
    status,
    method: row.account_type === 'bank' ? 'bank' : 'upi',
    payoutDestination: resolvePayoutDestination(row),
    failureReason: row.failure_reason ?? undefined,
    processedAt: row.processed_at ?? undefined,
  };
}

function mapRewardItem(row: ActivityFeedRow): IActivityRewardItem | null {
  if (!row.reward_item_id || !row.reward_item_name) {
    return null;
  }
  return {
    id: row.reward_item_id,
    name: row.reward_item_name,
    imageUrl: row.reward_item_image_url ?? undefined,
  };
}

function mapFeedRow(row: ActivityFeedRow, scope: ActivityScope): IActivityItem {
  const walletAmount =
    row.wallet_amount === null || row.wallet_amount === undefined
      ? null
      : Number(row.wallet_amount);
  const rewardPoints =
    row.reward_points === null || row.reward_points === undefined
      ? null
      : Number(row.reward_points);

  const includeReward = scope !== 'wallet';
  const includeWallet = scope !== 'rewards';

  return {
    id: row.id,
    kind: row.kind,
    title: buildTitle(row),
    subtitle: buildSubtitle(row),
    status: mapFeedStatus(row),
    occurredAt: row.occurred_at,
    wallet:
      includeWallet && walletAmount !== null && row.wallet_direction
        ? { amount: walletAmount, direction: row.wallet_direction }
        : null,
    reward:
      includeReward && rewardPoints !== null && row.reward_direction
        ? { points: rewardPoints, direction: row.reward_direction }
        : null,
    product: row.kind === 'qr_redemption' ? mapProduct(row) : null,
    batch: row.kind === 'qr_redemption' ? mapBatch(row) : null,
    withdrawal:
      row.kind === 'withdrawal' || row.kind === 'withdrawal_refund'
        ? mapWithdrawal(row)
        : null,
    rewardItem: row.kind === 'reward_redeem' ? mapRewardItem(row) : null,
    remarks: row.remarks ?? null,
  };
}

export class ActivityService {
  async getFeed(query: ActivityFeedQuery): Promise<ActivityFeedResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const scope = query.scope ?? 'all';

    const { items, total } = await activityRepository.findFeedByUserId(
      query.userId,
      page,
      limit,
      scope
    );

    return {
      items: items.map((row) => mapFeedRow(row, scope)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const activityService = new ActivityService();
