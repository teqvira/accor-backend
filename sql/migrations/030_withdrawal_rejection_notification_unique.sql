-- Migration 030: Ensure withdrawal rejection notification is unique per withdrawal
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_withdrawal_rejection
  ON notifications (reference_type, reference_id)
  WHERE reference_type = 'withdrawal_rejection'
    AND reference_id IS NOT NULL;
