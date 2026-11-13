-- Persistent CarMaa social feed: image/text posts, likes and comments.
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  body varchar(2200) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT social_posts_content_check CHECK (length(btrim(body)) > 0 OR image_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS social_posts_feed_idx ON social_posts(created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS social_posts_owner_idx ON social_posts(owner_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS social_post_likes (
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS social_post_likes_user_idx ON social_post_likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body varchar(800) NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 800),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS social_post_comments_post_idx ON social_post_comments(post_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS social_post_comments_owner_idx ON social_post_comments(owner_id, created_at DESC) WHERE deleted_at IS NULL;
