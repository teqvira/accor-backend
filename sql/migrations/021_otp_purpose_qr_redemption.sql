-- =======================================================
-- Allow OTP purpose for post-scan QR redemption
-- Idempotent
-- =======================================================

ALTER TABLE otp_verifications
  DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;

ALTER TABLE otp_verifications
  ADD CONSTRAINT otp_verifications_purpose_check
  CHECK (purpose IN ('login', 'password_reset', 'qr_redemption'));
