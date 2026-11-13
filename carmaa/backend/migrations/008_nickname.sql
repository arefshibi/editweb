-- Public display name (nickname). Shown to other users instead of the legal first/last name when set.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname varchar(40);
