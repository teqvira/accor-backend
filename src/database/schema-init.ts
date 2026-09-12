import pool from './connection';

export async function initCampaignSchema(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS apply_bonus_to VARCHAR(20) NOT NULL DEFAULT 'both';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_apply_bonus_to_check'
        ) THEN
          ALTER TABLE campaigns
            ADD CONSTRAINT campaigns_apply_bonus_to_check
            CHECK (apply_bonus_to IN ('cash', 'reward', 'both'));
        END IF;
      END $$;

      ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS pincodes VARCHAR(6)[] DEFAULT '{}';

      UPDATE campaigns
      SET pincodes = ARRAY[pincode]
      WHERE pincode IS NOT NULL AND (pincodes IS NULL OR cardinality(pincodes) = 0);

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_pincode_target_check'
        ) THEN
          ALTER TABLE campaigns DROP CONSTRAINT campaigns_pincode_target_check;
        END IF;

        ALTER TABLE campaigns
          ADD CONSTRAINT campaigns_pincode_target_check
          CHECK (
            (pincode_scope = 'all' AND (pincode IS NULL AND (pincodes IS NULL OR cardinality(pincodes) = 0)))
            OR (pincode_scope = 'specific' AND (pincode IS NOT NULL OR cardinality(pincodes) > 0))
          );
      END $$;

      CREATE INDEX IF NOT EXISTS idx_campaigns_apply_bonus_to ON campaigns (apply_bonus_to);
      CREATE INDEX IF NOT EXISTS idx_campaigns_pincodes_gin ON campaigns USING GIN (pincodes);

      DELETE FROM reward_redemptions a
      USING reward_redemptions b
      WHERE a.user_id = b.user_id
        AND a.reward_id = b.reward_id
        AND a.status IN ('pending', 'gifted')
        AND b.status IN ('pending', 'gifted')
        AND a.created_at < b.created_at;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_redemptions_user_reward_active
        ON reward_redemptions (user_id, reward_id)
        WHERE status IN ('pending', 'gifted');
    `);
    console.log('Campaign schema checked/updated (apply_bonus_to + pincodes)');
    console.log('Reward uniqueness checked/updated (one active redemption per user/reward)');
  } catch (err) {
    console.error('Failed to initialize campaign schema:', err);
  }
}

export async function initAccountDeletionSchema(): Promise<void> {
  try {
    // 1) Soft-delete column first — required by user SELECT columns in new code
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_users_deleted_at
        ON users (deleted_at)
        WHERE deleted_at IS NOT NULL;
    `);

    // 2) Deletion request table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users (id),
        mobile_number VARCHAR(20) NOT NULL,
        source VARCHAR(20) NOT NULL
          CHECK (source IN ('app', 'website', 'admin')),
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'completed', 'cancelled')),
        reason TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        scheduled_for TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        processed_by UUID REFERENCES users (id) ON DELETE SET NULL,
        cancelled_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_account_deletion_requests_pending_user
        ON account_deletion_requests (user_id)
        WHERE status = 'pending';

      CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status_scheduled
        ON account_deletion_requests (status, scheduled_for)
        WHERE status = 'pending';

      CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_requested
        ON account_deletion_requests (requested_at DESC);
    `);

    // 3) OTP purpose (skip if otp table missing)
    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('public.otp_verifications') IS NULL THEN
          RETURN;
        END IF;

        ALTER TABLE otp_verifications
          DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;

        ALTER TABLE otp_verifications
          ADD CONSTRAINT otp_verifications_purpose_check
          CHECK (purpose IN (
            'login',
            'password_reset',
            'qr_redemption',
            'withdrawal',
            'account_deletion'
          ));
      END $$;
    `);

    // 4) Notifications type (skip if table missing)
    await pool.query(`
      DO $$
      DECLARE
        con TEXT;
      BEGIN
        IF to_regclass('public.notifications') IS NULL THEN
          RETURN;
        END IF;

        SELECT c.conname INTO con
        FROM pg_constraint c
        WHERE c.conrelid = 'notifications'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%partner_request%';

        IF con IS NOT NULL THEN
          EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', con);
        END IF;

        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

        ALTER TABLE notifications
          ADD CONSTRAINT notifications_type_check
          CHECK (type IN (
            'partner_request',
            'reward_request',
            'wallet_transaction',
            'campaign_expiry',
            'coupon_expiry',
            'admin_broadcast',
            'account_deletion'
          ));
      END $$;
    `);

    console.log('Account deletion schema checked/updated');
  } catch (err) {
    console.error('Failed to initialize account deletion schema:', err);
  }
}
