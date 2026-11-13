-- Heart/like on a chat message (double-tap in the chat). One row per (message, user).
CREATE TABLE IF NOT EXISTS message_likes (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
