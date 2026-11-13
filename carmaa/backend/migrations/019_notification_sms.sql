ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sms_processed_at timestamptz;
-- Existing notifications must never trigger SMS: mark everything that exists now as processed.
UPDATE notifications SET sms_processed_at = now() WHERE sms_processed_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_sms_pending_idx ON notifications(created_at) WHERE sms_processed_at IS NULL;
