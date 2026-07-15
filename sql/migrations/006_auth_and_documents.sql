-- =======================================================
-- Auth Support & User Documents
-- =======================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON refresh_tokens (user_id, token_hash)
  WHERE revoked = false;

CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  mobile_number VARCHAR(20),
  email VARCHAR(255),

  -- Store hashed OTP only (never plaintext)
  otp_hash VARCHAR(255) NOT NULL,

  purpose VARCHAR(30) NOT NULL
    CHECK (purpose IN ('login', 'password_reset')),

  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_mobile
  ON otp_verifications (mobile_number, purpose, created_at DESC)
  WHERE mobile_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_email
  ON otp_verifications (email, purpose, created_at DESC)
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  document_type VARCHAR(50),
  document_number VARCHAR(100),
  document_front VARCHAR(2048),
  document_back VARCHAR(2048),

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_status ON user_documents (status);
