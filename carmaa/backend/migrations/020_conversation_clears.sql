-- 020: a user can delete a conversation for themselves only (the other person keeps it).
-- Messages older than cleared_at are hidden for that user; a newer message makes the chat reappear.
CREATE TABLE IF NOT EXISTS conversation_clears (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cleared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_clears_user_idx ON conversation_clears(user_id);
