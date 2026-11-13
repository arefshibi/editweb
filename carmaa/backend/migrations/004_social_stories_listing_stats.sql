-- Persistent social graph, 24-hour stories, and listing interaction analytics.
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  listing_id text REFERENCES listings(id) ON DELETE SET NULL,
  caption varchar(200) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS stories_active_idx ON stories(expires_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_owner_active_idx ON stories(owner_id, expires_at DESC);
CREATE TABLE IF NOT EXISTS story_views (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES users(id) ON DELETE CASCADE,
  device_digest bytea,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((viewer_id IS NOT NULL)::int + (device_digest IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS story_views_user_unique ON story_views(story_id, viewer_id) WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS story_views_device_unique ON story_views(story_id, device_digest) WHERE device_digest IS NOT NULL;
CREATE INDEX IF NOT EXISTS story_views_story_idx ON story_views(story_id, viewed_at DESC);
CREATE TABLE IF NOT EXISTS listing_interaction_events (
  id bigserial PRIMARY KEY,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  device_digest bytea,
  event_type text NOT NULL CHECK (event_type IN ('view','contact_click','share','favorite')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_interaction_events_stats_idx ON listing_interaction_events(listing_id,event_type,created_at DESC);
