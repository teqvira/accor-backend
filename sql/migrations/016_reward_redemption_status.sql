-- =======================================================
-- Reward redemption request status (admin gift flow)
-- pending  = user requested gift (points already deducted)
-- gifted   = admin marked gift as delivered / fulfilled
-- rejected = admin rejected (points refunded)
-- Idempotent (safe to re-run)
-- =======================================================

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

-- Backfill existing rows as already completed gifts
UPDATE reward_redemptions
SET status = 'gifted',
    processed_at = COALESCE(processed_at, redeemed_at)
WHERE status IS NULL;

ALTER TABLE reward_redemptions
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE reward_redemptions
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE reward_redemptions
  DROP CONSTRAINT IF EXISTS reward_redemptions_status_check;

ALTER TABLE reward_redemptions
  ADD CONSTRAINT reward_redemptions_status_check
  CHECK (status IN ('pending', 'gifted', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_status_redeemed
  ON reward_redemptions (status, redeemed_at DESC);
