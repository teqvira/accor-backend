-- =======================================================
-- Partner approval (dealer + mechanic = users.role=user)
-- pending  = mobile registered, waiting admin
-- approved = can use Accor app
-- rejected = blocked
-- Idempotent
-- =======================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20);

UPDATE users
SET approval_status = 'approved'
WHERE approval_status IS NULL;

ALTER TABLE users
  ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_approval_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_users_approval_status
  ON users (approval_status)
  WHERE role = 'user';

CREATE INDEX IF NOT EXISTS idx_users_user_type
  ON users (user_type)
  WHERE role = 'user';
