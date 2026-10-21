-- Migration 029: Add admin review and UTR fields to withdrawals
ALTER TABLE withdrawals 
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawals_reviewed_by ON withdrawals (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_withdrawals_utr_number ON withdrawals (utr_number);
