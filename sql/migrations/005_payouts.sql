-- =======================================================
-- Payout Profiles & Withdrawals
-- =======================================================

CREATE TABLE IF NOT EXISTS payout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL UNIQUE REFERENCES users (id),

  account_type VARCHAR(20) NOT NULL
    CHECK (account_type IN ('upi', 'bank')),

  upi_id VARCHAR(255),
  account_holder_name VARCHAR(255),
  bank_name VARCHAR(255),
  account_number VARCHAR(100),
  ifsc_code VARCHAR(20),

  is_default BOOLEAN NOT NULL DEFAULT true,

  -- Provider sync cache (not part of domain model; used by payout adapters)
  provider VARCHAR(50),
  provider_contact_id VARCHAR(255),
  provider_fund_account_id VARCHAR(255),
  cashfree_beneficiary_id VARCHAR(255),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_profiles_user ON payout_profiles (user_id);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id),
  payout_profile_id UUID NOT NULL REFERENCES payout_profiles (id),

  amount NUMERIC(12, 2) NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'success', 'failed')),

  transaction_reference VARCHAR(255),
  remarks TEXT,

  -- Provider sync cache
  provider VARCHAR(50),
  provider_payout_id VARCHAR(255),

  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_transaction_reference
  ON withdrawals (transaction_reference)
  WHERE transaction_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals (status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_payout_profile ON withdrawals (payout_profile_id);
