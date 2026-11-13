-- 019: owner can hide their stories from specific users.
CREATE TABLE IF NOT EXISTS story_hides (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, hidden_user_id),
  CHECK (owner_id <> hidden_user_id)
);
CREATE INDEX IF NOT EXISTS story_hides_hidden_idx ON story_hides(hidden_user_id);
