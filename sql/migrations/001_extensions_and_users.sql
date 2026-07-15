-- =======================================================
-- ACCOR QR Backend - Extensions & Users
-- =======================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) NOT NULL,

  email VARCHAR(255),
  mobile_number VARCHAR(20),

  password_hash VARCHAR(255),

  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('super_admin', 'admin', 'user')),

  wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile
  ON users (mobile_number)
  WHERE mobile_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
