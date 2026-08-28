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
