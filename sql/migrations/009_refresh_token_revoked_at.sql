-- =======================================================
-- Track when refresh tokens are blocked/rotated
-- =======================================================

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;

UPDATE refresh_tokens
SET revoked_at = created_at
WHERE revoked = true
  AND revoked_at IS NULL;
