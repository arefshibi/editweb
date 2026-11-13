-- 013: server-side storage for two more things that used to live only in the browser
--   * showroom ranking history / movement arrows  (was localStorage "carmaa_showroom_rank_history_v1")
--   * "seen" state of stories per signed-in user  (was localStorage "marque_stories_seen_v1")
-- (showroom "joined" date needs no table: it is showrooms.created_at.)
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS showroom_rank_snapshots (
  sort_key text NOT NULL CHECK (sort_key IN ('activity','listings','recent','popular','rating')),
  showroom_id uuid NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  prev_rank integer CHECK (prev_rank IS NULL OR prev_rank > 0),
  moved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sort_key, showroom_id)
);

CREATE TABLE IF NOT EXISTS story_seen (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS story_seen_user_idx ON story_seen(user_id, seen_at DESC);
