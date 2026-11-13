-- Admin-managed advertising cards shown between listing cards on the listings page.
CREATE TABLE IF NOT EXISTS ad_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  cta_text text NOT NULL DEFAULT 'مشاهده',
  badge_text text NOT NULL DEFAULT 'تبلیغ',
  position integer NOT NULL DEFAULT 4 CHECK (position BETWEEN 1 AND 50),
  repeat_every integer NOT NULL DEFAULT 0 CHECK (repeat_every BETWEEN 0 AND 50),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  views bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_cards_active_idx ON ad_cards(is_active, sort_order, created_at DESC);
