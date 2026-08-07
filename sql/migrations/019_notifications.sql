-- =======================================================
-- In-app notifications + push delivery tracking (FCM)
-- =======================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,

  -- Event / broadcast category
  type VARCHAR(50) NOT NULL
    CHECK (type IN (
      'partner_request',
      'reward_request',
      'wallet_transaction',
      'campaign_expiry',
      'coupon_expiry',
      'admin_broadcast'
    )),

  -- Who should receive this notification
  audience VARCHAR(20) NOT NULL
    CHECK (audience IN ('admin', 'user', 'all_users')),

  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  reference_type VARCHAR(50),
  reference_id UUID,

  created_by UUID REFERENCES users (id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON notifications (type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_audience_created
  ON notifications (audience, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_reference
  ON notifications (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- One expiry alert per campaign/coupon (avoid daily spam)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_expiry_reference
  ON notifications (type, reference_id)
  WHERE type IN ('campaign_expiry', 'coupon_expiry')
    AND reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  notification_id UUID NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  push_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (push_status IN ('pending', 'sent', 'failed', 'skipped')),
  push_error TEXT,
  pushed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_notification_recipients_user UNIQUE (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_created
  ON notification_recipients (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_unread
  ON notification_recipients (user_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notification_recipients_push_status
  ON notification_recipients (push_status)
  WHERE push_status = 'pending';
