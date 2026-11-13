-- 012: server-side storage for data that used to live only in the browser
--   * news likes / comments (+ replies, comment likes)   (was localStorage "carma_news_social_v1")
--   * showroom hashtags                                   (was localStorage "mr_dealer_tags_v1")
-- Safe to re-run: every statement is idempotent.

ALTER TABLE showrooms ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS news_likes (
  news_id varchar(64) NOT NULL CHECK (news_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_id, user_id)
);

CREATE TABLE IF NOT EXISTS news_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id varchar(64) NOT NULL CHECK (news_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES news_comments(id) ON DELETE CASCADE,
  body varchar(500) NOT NULL CHECK (length(btrim(body)) > 0),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_comments_news_idx ON news_comments(news_id, created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS news_comments_user_idx ON news_comments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS news_comment_likes (
  comment_id uuid NOT NULL REFERENCES news_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
