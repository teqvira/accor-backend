CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  email VARCHAR(255),
  mobile_number VARCHAR(20),
  password VARCHAR(255),
  wallet_balance NUMERIC(12,2) DEFAULT 0,
  reward_points INTEGER DEFAULT 0,
  role VARCHAR(20) DEFAULT 'user'
    CHECK (role IN ('super_admin', 'admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  otp_hash VARCHAR(255),
  otp_expires_at TIMESTAMP,
  otp_last_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile
  ON users(mobile_number) WHERE mobile_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
  ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS qr_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  total_qrs INTEGER NOT NULL,
  generated_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'assigned')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  batch_id UUID REFERENCES qr_batches(id),
  redeemed BOOLEAN DEFAULT false,
  redeemed_by UUID REFERENCES users(id),
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_batch ON qr_codes(batch_id);

CREATE TABLE IF NOT EXISTS reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL,
  type VARCHAR(10) CHECK (type IN ('credit', 'debit')),
  reference_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_tx_user
  ON reward_transactions(user_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  type VARCHAR(10) CHECK (type IN ('credit', 'debit')),
  reference_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user
  ON wallet_transactions(user_id);

CREATE TABLE IF NOT EXISTS redemption_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  qr_code_id UUID UNIQUE NOT NULL REFERENCES qr_codes(id),
  wallet_amount NUMERIC(12,2),
  reward_points INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(20) CHECK (method IN ('upi', 'bank')),
  status VARCHAR(30),
  provider VARCHAR(50),
  provider_payout_id VARCHAR(255),
  provider_reference_id VARCHAR(255) UNIQUE,
  failure_reason TEXT,
  payout_destination JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user
  ON withdrawals(user_id);

CREATE TABLE IF NOT EXISTS payout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  method VARCHAR(20),
  account_holder_name VARCHAR(255),
  upi_id VARCHAR(255),
  account_number VARCHAR(100),
  ifsc VARCHAR(20),
  provider VARCHAR(50),
  provider_contact_id VARCHAR(255),
  provider_fund_account_id VARCHAR(255),
  cashfree_beneficiary_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
