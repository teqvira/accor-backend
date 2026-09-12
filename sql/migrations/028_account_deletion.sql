-- =======================================================
-- Account deletion (soft delete + website 4-day hold)
-- Idempotent
-- =======================================================

-- Soft-delete marker on users (row kept; login blocked via is_active=false)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- OTP purpose for public website identity verification
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

-- Website / app deletion request tracking
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

-- One open hold per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_deletion_requests_pending_user
  ON account_deletion_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status_scheduled
  ON account_deletion_requests (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_requested
  ON account_deletion_requests (requested_at DESC);

-- Admin notification type (only if notifications table exists)
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

  ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

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