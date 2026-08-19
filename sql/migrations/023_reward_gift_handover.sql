-- =======================================================
-- Gift handover proof for admin field ops
-- Captured when a pending redemption is marked gifted
-- Idempotent (safe to re-run)
-- =======================================================

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS handover_image_url TEXT;

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS recipient_note TEXT;

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS handover_date TIMESTAMP;
