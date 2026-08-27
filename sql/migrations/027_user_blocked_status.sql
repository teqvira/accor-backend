-- =======================================================
-- ACCOR QR Backend - User Blocked Status
-- Adds is_blocked column to allow blocking / unblocking partners
-- Idempotent
-- =======================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_blocked
  ON users (is_blocked)
  WHERE role = 'user';
