CREATE TABLE IF NOT EXISTS partner_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('have','want')),
  make varchar(80) NOT NULL,
  model varchar(100) NOT NULL DEFAULT '',
  year_from smallint CHECK (year_from IS NULL OR year_from BETWEEN 1300 AND 2100),
  year_to smallint CHECK (year_to IS NULL OR year_to BETWEEN 1300 AND 2100),
  city varchar(80) NOT NULL DEFAULT '',
  price_toman bigint CHECK (price_toman IS NULL OR price_toman >= 0),
  note varchar(300) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS partner_posts_feed_idx ON partner_posts(kind, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS partner_posts_showroom_idx ON partner_posts(showroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_posts_make_idx ON partner_posts(lower(make)) WHERE status = 'active';
