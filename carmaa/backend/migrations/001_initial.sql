CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user','moderator','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active','suspended','deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('draft','pending','published','rejected','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','paid','failed','expired','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('new','reviewing','resolved','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name varchar(80) NOT NULL DEFAULT '',
  avatar_url text,
  role user_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'active',
  phone_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at DESC);

CREATE TABLE IF NOT EXISTS auth_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  code_digest bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  request_ip_hash bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS auth_otps_phone_created_idx ON auth_otps(phone_e164, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_otps_expiry_idx ON auth_otps(expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent_hash bytea
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions(token_digest, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  public_url text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type = 'image/webp'),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS images_owner_idx ON images(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS showrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(80) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  city varchar(80) NOT NULL DEFAULT '',
  address varchar(300) NOT NULL DEFAULT '',
  description varchar(2000) NOT NULL DEFAULT '',
  logo_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  phone_public boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS showrooms_status_city_idx ON showrooms(status, city);

CREATE TABLE IF NOT EXISTS listings (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  showroom_id uuid REFERENCES showrooms(id) ON DELETE SET NULL,
  title varchar(160) NOT NULL,
  make varchar(80) NOT NULL,
  model varchar(100) NOT NULL,
  trim varchar(100) NOT NULL DEFAULT '',
  year smallint NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  mileage_km integer CHECK (mileage_km IS NULL OR mileage_km BETWEEN 0 AND 3000000),
  body_type varchar(40) NOT NULL DEFAULT '',
  fuel_type varchar(40) NOT NULL DEFAULT '',
  transmission varchar(40) NOT NULL DEFAULT '',
  color varchar(50) NOT NULL DEFAULT '',
  condition_note varchar(1000) NOT NULL DEFAULT '',
  description varchar(5000) NOT NULL DEFAULT '',
  city varchar(80) NOT NULL,
  price_toman bigint CHECK (price_toman IS NULL OR price_toman >= 0),
  price_negotiable boolean NOT NULL DEFAULT false,
  status listing_status NOT NULL DEFAULT 'pending',
  rejection_reason varchar(1000),
  urgent_until timestamptz,
  bumped_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS listings_public_search_idx ON listings(status, city, make, model, year DESC, created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_showroom_idx ON listings(showroom_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_bumped_idx ON listings(bumped_at DESC NULLS LAST) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS listing_images (
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 11),
  PRIMARY KEY (listing_id, image_id),
  UNIQUE (listing_id, position)
);

CREATE TABLE IF NOT EXISTS listing_private_details (
  listing_id text PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minimum_offer_toman bigint CHECK (minimum_offer_toman IS NULL OR minimum_offer_toman >= 0),
  seller_phone_public boolean NOT NULL DEFAULT false,
  private_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_price_history (
  id bigserial PRIMARY KEY,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  old_price_toman bigint,
  new_price_toman bigint,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_price_history_idx ON listing_price_history(listing_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS listing_favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  followed_showroom_id uuid REFERENCES showrooms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((followed_user_id IS NOT NULL)::int + (followed_showroom_id IS NOT NULL)::int = 1),
  CHECK (followed_user_id IS NULL OR followed_user_id <> follower_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS follows_user_unique ON follows(follower_id, followed_user_id) WHERE followed_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS follows_showroom_unique ON follows(follower_id, followed_showroom_id) WHERE followed_showroom_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(120) NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_price_changes boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id),
  UNIQUE(listing_id, buyer_id, seller_id)
);
CREATE INDEX IF NOT EXISTS conversations_buyer_idx ON conversations(buyer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_seller_idx ON conversations(seller_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body varchar(3000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (length(body) BETWEEN 1 AND 3000)
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_id <> blocked_id),
  PRIMARY KEY(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(40) NOT NULL,
  title varchar(160) NOT NULL,
  body varchar(500) NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id text REFERENCES listings(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  reason varchar(80) NOT NULL,
  details varchar(1500) NOT NULL DEFAULT '',
  status report_status NOT NULL DEFAULT 'new',
  resolution_note varchar(1000),
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (listing_id IS NOT NULL OR reported_user_id IS NOT NULL OR message_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  service_key varchar(30) NOT NULL CHECK (service_key IN ('ladder','urgent','renew')),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  amount_rial bigint NOT NULL CHECK (amount_rial > 0),
  status payment_status NOT NULL DEFAULT 'pending',
  provider varchar(30) NOT NULL,
  provider_authority varchar(100) UNIQUE,
  provider_ref_id varchar(100),
  idempotency_key varchar(120) NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status, expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  target_type varchar(60) NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id varchar(100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_records (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key varchar(120) NOT NULL,
  route_key varchar(120) NOT NULL,
  request_digest bytea NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY(user_id, idempotency_key, route_key)
);


CREATE TABLE IF NOT EXISTS listing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  message varchar(1000) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, buyer_id, created_at)
);
CREATE INDEX IF NOT EXISTS listing_offers_listing_idx ON listing_offers(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_offers_buyer_idx ON listing_offers(buyer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qa_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(180) NOT NULL,
  body varchar(5000) NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_questions_public_idx ON qa_questions(created_at DESC) WHERE status = 'published';
CREATE TABLE IF NOT EXISTS qa_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body varchar(5000) NOT NULL,
  is_accepted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_answers_question_idx ON qa_answers(question_id, created_at ASC) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS showroom_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(showroom_id, reviewer_id),
  CHECK (reviewer_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS showroom_reviews_idx ON showroom_reviews(showroom_id, created_at DESC);

