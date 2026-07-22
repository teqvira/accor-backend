-- =======================================================
-- Device tokens, user sessions, invalid token tracking
-- Supports multi-device login + push notification prep
-- =======================================================

-- Active / historical device tokens (FCM / APNs / web push)
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  device_token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('ios', 'android', 'web', 'unknown')),

  device_id VARCHAR(255),
  device_name VARCHAR(255),
  app_version VARCHAR(50),

  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_device_tokens_user_token UNIQUE (user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_active
  ON user_device_tokens (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_token
  ON user_device_tokens (device_token);

-- Login sessions (multiple concurrent logins per user allowed)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_token_id UUID REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  device_token_id UUID REFERENCES user_device_tokens (id) ON DELETE SET NULL,

  ip_address VARCHAR(45),
  user_agent TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  logged_out_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON user_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token
  ON user_sessions (refresh_token_id)
  WHERE refresh_token_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_device_token
  ON user_sessions (device_token_id)
  WHERE device_token_id IS NOT NULL;

-- Device tokens invalidated on logout / revoke (audit trail)
CREATE TABLE IF NOT EXISTS invalid_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  device_token_id UUID,
  device_token TEXT NOT NULL,
  platform VARCHAR(20),

  reason VARCHAR(50) NOT NULL DEFAULT 'logout'
    CHECK (reason IN (
      'logout',
      'revoked',
      'replaced',
      'expired',
      'admin_revoke'
    )),

  session_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invalid_device_tokens_user
  ON invalid_device_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invalid_device_tokens_token
  ON invalid_device_tokens (device_token);

-- Auth tokens invalidated on logout / rotate / password reset (prep for denylist checks)
CREATE TABLE IF NOT EXISTS invalid_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  token_hash VARCHAR(255) NOT NULL,
  token_type VARCHAR(20) NOT NULL
    CHECK (token_type IN ('access', 'refresh')),

  reason VARCHAR(50) NOT NULL DEFAULT 'logout'
    CHECK (reason IN (
      'logout',
      'refresh_rotate',
      'password_reset',
      'revoked',
      'reuse_detected',
      'admin_revoke'
    )),

  session_id UUID,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invalid_auth_tokens_hash
  ON invalid_auth_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_invalid_auth_tokens_user
  ON invalid_auth_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invalid_auth_tokens_expires
  ON invalid_auth_tokens (expires_at)
  WHERE expires_at IS NOT NULL;

-- Track updates on refresh tokens (multi-login timeline)
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE refresh_tokens
SET updated_at = COALESCE(revoked_at, created_at)
WHERE updated_at IS NULL
   OR updated_at = created_at;
