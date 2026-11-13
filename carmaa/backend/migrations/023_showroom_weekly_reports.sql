-- Weekly showroom report: one row per showroom per Tehran Friday (dedupes the scheduler).
CREATE TABLE IF NOT EXISTS showroom_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_key date NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  sms_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (showroom_id, week_key)
);
CREATE INDEX IF NOT EXISTS showroom_weekly_reports_owner_idx ON showroom_weekly_reports(owner_id, week_key DESC);
