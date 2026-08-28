import pool from '../../database/connection';
import {
  ActivityFeedRow,
  ActivityScope,
} from './activity.types';

function buildFeedSql(scope: ActivityScope): {
  feedSql: string;
  countSql: string;
} {
  const includeQr = scope === 'all' || scope === 'wallet' || scope === 'rewards';
  const includeWallet = scope === 'all' || scope === 'wallet';
  const includeReward = scope === 'all' || scope === 'rewards';
  const qrScopeFilter =
    scope === 'wallet'
      ? 'AND rt.user_id = $1 AND rt.wallet_amount > 0'
      : scope === 'rewards'
        ? `AND COALESCE(rt.points_credited_to_user_id, rt.user_id) = $1
           AND rt.reward_points > 0`
        : `AND (rt.user_id = $1 OR COALESCE(rt.points_credited_to_user_id, rt.user_id) = $1)`;

  const branches: string[] = [];

  if (includeQr) {
    branches.push(`
      SELECT
        'qr_redemption'::text AS kind,
        rt.id AS id,
        rt.redeemed_at AS occurred_at,
        CASE WHEN rt.user_id = $1 THEN rt.wallet_amount ELSE 0 END::numeric AS wallet_amount,
        CASE WHEN rt.user_id = $1 AND rt.wallet_amount > 0 THEN 'credit' END::text AS wallet_direction,
        CASE
          WHEN COALESCE(rt.points_credited_to_user_id, rt.user_id) = $1
            THEN rt.reward_points
          ELSE 0
        END AS reward_points,
        CASE
          WHEN COALESCE(rt.points_credited_to_user_id, rt.user_id) = $1
            AND rt.reward_points > 0
            THEN 'credit'
        END::text AS reward_direction,
        p.id AS product_id,
        p.name::text AS product_name,
        p.sku_code::text AS product_sku,
        p.image_url::text AS product_image_url,
        p.color::text AS product_color,
        b.id AS batch_id,
        b.name::text AS batch_name,
        b.coupon_name::text AS batch_coupon_name,
        qc.code::text AS qr_code,
        NULL::uuid AS withdrawal_id,
        NULL::text AS withdrawal_status,
        NULL::text AS account_type,
        NULL::text AS upi_id,
        NULL::text AS account_number,
        NULL::text AS ifsc_code,
        NULL::text AS failure_reason,
        NULL::timestamp AS processed_at,
        NULL::uuid AS reward_item_id,
        NULL::text AS reward_item_name,
        NULL::text AS reward_item_image_url,
        NULL::text AS redemption_status,
        NULL::text AS remarks
      FROM redemption_transactions rt
      LEFT JOIN products p ON p.id = rt.product_id
      LEFT JOIN qr_batches b ON b.id = rt.batch_id
      LEFT JOIN qr_codes qc ON qc.id = rt.qr_code_id
      WHERE (rt.user_id = $1 OR COALESCE(rt.points_credited_to_user_id, rt.user_id) = $1)
        ${qrScopeFilter}
    `);
  }

  if (includeWallet) {
    branches.push(`
      SELECT
        CASE
          WHEN wt.reference_type = 'withdrawal' AND wt.type = 'debit'
            THEN 'withdrawal'
          WHEN wt.reference_type = 'withdrawal' AND wt.type = 'credit'
            THEN 'withdrawal_refund'
          ELSE 'wallet_adjustment'
        END::text AS kind,
        wt.id AS id,
        wt.created_at AS occurred_at,
        wt.amount::numeric AS wallet_amount,
        wt.type::text AS wallet_direction,
        NULL::integer AS reward_points,
        NULL::text AS reward_direction,
        NULL::uuid AS product_id,
        NULL::text AS product_name,
        NULL::text AS product_sku,
        NULL::text AS product_image_url,
        NULL::text AS product_color,
        NULL::uuid AS batch_id,
        NULL::text AS batch_name,
        NULL::text AS batch_coupon_name,
        NULL::text AS qr_code,
        w.id AS withdrawal_id,
        w.status::text AS withdrawal_status,
        pp.account_type::text AS account_type,
        pp.upi_id::text AS upi_id,
        pp.account_number::text AS account_number,
        pp.ifsc_code::text AS ifsc_code,
        w.remarks::text AS failure_reason,
        w.processed_at AS processed_at,
        NULL::uuid AS reward_item_id,
        NULL::text AS reward_item_name,
        NULL::text AS reward_item_image_url,
        NULL::text AS redemption_status,
        wt.remarks::text AS remarks
      FROM wallet_transactions wt
      LEFT JOIN withdrawals w
        ON w.id = wt.reference_id
       AND wt.reference_type = 'withdrawal'
      LEFT JOIN payout_profiles pp ON pp.id = w.payout_profile_id
      WHERE wt.user_id = $1
        AND wt.reference_type IS DISTINCT FROM 'qr_redemption'
    `);
  }

  if (includeReward) {
    branches.push(`
      SELECT
        CASE
          WHEN rwt.reference_type = 'reward_redeem' THEN 'reward_redeem'
          ELSE 'reward_adjustment'
        END::text AS kind,
        rwt.id AS id,
        rwt.created_at AS occurred_at,
        NULL::numeric AS wallet_amount,
        NULL::text AS wallet_direction,
        rwt.points AS reward_points,
        rwt.type::text AS reward_direction,
        NULL::uuid AS product_id,
        NULL::text AS product_name,
        NULL::text AS product_sku,
        NULL::text AS product_image_url,
        NULL::text AS product_color,
        NULL::uuid AS batch_id,
        NULL::text AS batch_name,
        NULL::text AS batch_coupon_name,
        NULL::text AS qr_code,
        NULL::uuid AS withdrawal_id,
        NULL::text AS withdrawal_status,
        NULL::text AS account_type,
        NULL::text AS upi_id,
        NULL::text AS account_number,
        NULL::text AS ifsc_code,
        NULL::text AS failure_reason,
        NULL::timestamp AS processed_at,
        COALESCE(rr.reward_id, rc.id) AS reward_item_id,
        COALESCE(rr.reward_name, rc.name)::text AS reward_item_name,
        COALESCE(rr.reward_image_url, rc.image_url)::text AS reward_item_image_url,
        rr.status::text AS redemption_status,
        rwt.remarks::text AS remarks
      FROM reward_transactions rwt
      LEFT JOIN reward_redemptions rr
        ON rr.id = rwt.reference_id
       AND rwt.reference_type = 'reward_redeem'
      LEFT JOIN reward_catalog rc ON rc.id = rr.reward_id
      WHERE rwt.user_id = $1
        AND rwt.reference_type IS DISTINCT FROM 'qr_redemption'
    `);
  }

  const unionBody = branches.join('\nUNION ALL\n');

  return {
    feedSql: `
      SELECT * FROM (
        ${unionBody}
      ) f
      ORDER BY f.occurred_at DESC, f.id DESC
      LIMIT $2 OFFSET $3
    `,
    countSql: `
      SELECT COUNT(*)::text AS count FROM (
        ${unionBody}
      ) f
    `,
  };
}

export const activityRepository = {
  findFeedByUserId: async (
    userId: string,
    page = 1,
    limit = 10,
    scope: ActivityScope = 'all'
  ): Promise<{ items: ActivityFeedRow[]; total: number }> => {
    const offset = (page - 1) * limit;
    const { feedSql, countSql } = buildFeedSql(scope);

    const [itemsResult, countResult] = await Promise.all([
      pool.query<ActivityFeedRow>(feedSql, [userId, limit, offset]),
      pool.query<{ count: string }>(countSql, [userId]),
    ]);

    return {
      items: itemsResult.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },
};
