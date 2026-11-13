-- Chat photos / voice messages and the story a reply refers to.
-- kind: 'text' | 'image' | 'voice'. media_* describe the stored file; story_ref is a server-built
-- snapshot of the story being replied to (id, thumb url, caption) so the story card survives the 24 h expiry.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind varchar(8) NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime varchar(40);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_meta jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS story_ref jsonb;

-- A media message may have an empty caption; text messages still need 1..3000 characters.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'messages'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%length(body)%'
  LOOP
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE messages ADD CONSTRAINT messages_body_by_kind_check CHECK (
  length(body) <= 3000
  AND (kind = 'text' AND length(body) >= 1 OR kind IN ('image','voice') AND media_url IS NOT NULL)
);
ALTER TABLE messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text','image','voice'));
