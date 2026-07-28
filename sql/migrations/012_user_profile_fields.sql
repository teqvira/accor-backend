-- =======================================================
-- User profile fields + document type uniqueness
-- =======================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_user_type_check
      CHECK (user_type IS NULL OR user_type IN ('mechanic', 'dealer'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_documents_user_type
  ON user_documents (user_id, document_type)
  WHERE document_type IS NOT NULL;
