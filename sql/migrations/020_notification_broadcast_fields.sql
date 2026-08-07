-- =======================================================
-- Admin broadcast fields: NFT code + UI type (Reminder/Campaign/Info/Alert)
-- =======================================================

CREATE SEQUENCE IF NOT EXISTS notification_code_seq START 1;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS code VARCHAR(20);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS broadcast_type VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_notifications_broadcast_type'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT chk_notifications_broadcast_type
      CHECK (
        broadcast_type IS NULL
        OR broadcast_type IN ('reminder', 'campaign', 'info', 'alert')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_code
  ON notifications (code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_broadcast_type
  ON notifications (broadcast_type)
  WHERE broadcast_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_admin_broadcast_created
  ON notifications (created_at DESC)
  WHERE type = 'admin_broadcast';
