ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notify boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS sms_notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_notifications_user_kind_idx ON sms_notifications(user_id, kind, created_at DESC);
