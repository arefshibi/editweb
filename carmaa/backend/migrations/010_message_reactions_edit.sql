-- Reactions (one emoji per user per message; reuses message_likes) and message editing.
ALTER TABLE message_likes ADD COLUMN IF NOT EXISTS emoji varchar(16) NOT NULL DEFAULT '❤️';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
