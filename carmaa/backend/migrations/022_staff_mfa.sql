-- SEC2-PATCH (A15): TOTP for staff + per-session MFA mark
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_counter bigint;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;
