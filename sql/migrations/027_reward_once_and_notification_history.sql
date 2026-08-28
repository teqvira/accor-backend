-- One active (pending/gifted) redemption per user per reward.
-- Keep the latest row when duplicates already exist.

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
