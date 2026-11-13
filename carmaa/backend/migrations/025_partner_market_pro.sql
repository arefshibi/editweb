-- «بازار همکاران» نسخهٔ حرفه‌ای: پیشنهاد همکاری، اعتبار/امتیاز همکار، ذخیره، هشدار جستجو، همکاران مورد اعتماد، گزارش تخلف.

-- ── آگهی‌ها: جزئیات حرفه‌ای‌تر ────────────────────────────────────────────────
ALTER TABLE partner_posts
  ADD COLUMN IF NOT EXISTS color varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mileage_km integer CHECK (mileage_km IS NULL OR mileage_km BETWEEN 0 AND 3000000),
  ADD COLUMN IF NOT EXISTS deal_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS commission_percent numeric(4,1) CHECK (commission_percent IS NULL OR commission_percent BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS price_negotiable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_id text REFERENCES listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renew_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_reason text CHECK (closed_reason IS NULL OR closed_reason IN ('deal','sold_elsewhere','found','cancelled')),
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE partner_posts DROP CONSTRAINT IF EXISTS partner_posts_deal_types_chk;
ALTER TABLE partner_posts ADD CONSTRAINT partner_posts_deal_types_chk
  CHECK (deal_types <@ ARRAY['cash','exchange','installment','consignment']::text[]);
CREATE INDEX IF NOT EXISTS partner_posts_city_idx ON partner_posts(city) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS partner_posts_listing_idx ON partner_posts(listing_id) WHERE listing_id IS NOT NULL;

-- سال‌ها از این پس همیشه میلادی ذخیره می‌شوند (آگهی‌های قدیمیِ شمسی تبدیل می‌شوند)
UPDATE partner_posts SET year_from = year_from + 621 WHERE year_from < 1700;
UPDATE partner_posts SET year_to = year_to + 621 WHERE year_to < 1700;

-- ── بازدید همکاران از آگهی (یک بازدید به‌ازای هر نمایشگاه) ──────────────────────────
CREATE TABLE IF NOT EXISTS partner_post_views (
  post_id uuid NOT NULL REFERENCES partner_posts(id) ON DELETE CASCADE,
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, showroom_id)
);

-- ── پیشنهاد همکاری ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES partner_posts(id) ON DELETE CASCADE,
  my_post_id uuid REFERENCES partner_posts(id) ON DELETE SET NULL,
  from_showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  to_showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  from_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_toman bigint CHECK (amount_toman IS NULL OR amount_toman >= 0),
  commission_percent numeric(4,1) CHECK (commission_percent IS NULL OR commission_percent BETWEEN 0 AND 50),
  message varchar(500) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn','completed')),
  from_confirmed_at timestamptz,
  to_confirmed_at timestamptz,
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_showroom_id <> to_showroom_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_offers_open_unique ON partner_offers(post_id, from_showroom_id) WHERE status IN ('pending','accepted');
CREATE INDEX IF NOT EXISTS partner_offers_to_idx ON partner_offers(to_showroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_offers_from_idx ON partner_offers(from_showroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_offers_post_idx ON partner_offers(post_id, created_at DESC);

-- ── امتیاز متقابل بعد از معاملهٔ تأییدشدهٔ دو طرف ───────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES partner_offers(id) ON DELETE CASCADE,
  reviewer_showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  reviewee_showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}'::text[] CHECK (tags <@ ARRAY['fast','honest','fair_price','good_docs','professional','late','unresponsive']::text[]),
  comment varchar(300) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, reviewer_showroom_id),
  CHECK (reviewer_showroom_id <> reviewee_showroom_id)
);
CREATE INDEX IF NOT EXISTS partner_reviews_reviewee_idx ON partner_reviews(reviewee_showroom_id, created_at DESC);

-- ── ذخیره‌ها، همکاران مورد اعتماد، هشدار جستجو، گزارش ────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_saved (
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES partner_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (showroom_id, post_id)
);

CREATE TABLE IF NOT EXISTS partner_trusted (
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  trusted_showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (showroom_id, trusted_showroom_id),
  CHECK (showroom_id <> trusted_showroom_id)
);

CREATE TABLE IF NOT EXISTS partner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  kind text CHECK (kind IS NULL OR kind IN ('have','want')),
  make varchar(80) NOT NULL,
  model varchar(100) NOT NULL DEFAULT '',
  year_from smallint CHECK (year_from IS NULL OR year_from BETWEEN 1300 AND 2100),
  year_to smallint CHECK (year_to IS NULL OR year_to BETWEEN 1300 AND 2100),
  city varchar(80) NOT NULL DEFAULT '',
  price_max bigint CHECK (price_max IS NULL OR price_max >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_alerts_make_idx ON partner_alerts(lower(make));
CREATE INDEX IF NOT EXISTS partner_alerts_showroom_idx ON partner_alerts(showroom_id);

CREATE TABLE IF NOT EXISTS partner_post_reports (
  post_id uuid NOT NULL REFERENCES partner_posts(id) ON DELETE CASCADE,
  reporter_showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('fake','sold','spam','abuse','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, reporter_showroom_id)
);

-- ── اعتبار همکار: فقط از معاملات تأییدشدهٔ دو طرف و امتیازهای واقعی ────────────────────
CREATE OR REPLACE VIEW partner_reputation AS
SELECT s.id AS showroom_id,
  (SELECT count(*)::int FROM partner_offers o
    WHERE o.status='completed' AND (o.from_showroom_id=s.id OR o.to_showroom_id=s.id)) AS deals,
  (SELECT count(DISTINCT CASE WHEN o.from_showroom_id=s.id THEN o.to_showroom_id ELSE o.from_showroom_id END)::int
    FROM partner_offers o WHERE o.status='completed' AND (o.from_showroom_id=s.id OR o.to_showroom_id=s.id)) AS partners,
  (SELECT round(avg(r.rating)::numeric, 2) FROM partner_reviews r WHERE r.reviewee_showroom_id=s.id) AS rating_avg,
  (SELECT count(*)::int FROM partner_reviews r WHERE r.reviewee_showroom_id=s.id) AS rating_count,
  (SELECT count(*)::int FROM partner_offers o WHERE o.to_showroom_id=s.id AND o.created_at > now() - interval '90 days') AS offers_received,
  (SELECT count(*)::int FROM partner_offers o WHERE o.to_showroom_id=s.id AND o.created_at > now() - interval '90 days' AND o.responded_at IS NOT NULL) AS offers_answered,
  (SELECT round(avg(extract(epoch FROM (o.responded_at - o.created_at)) / 3600)::numeric, 1)
    FROM partner_offers o WHERE o.to_showroom_id=s.id AND o.created_at > now() - interval '90 days' AND o.responded_at IS NOT NULL) AS avg_response_hours
FROM showrooms s;
