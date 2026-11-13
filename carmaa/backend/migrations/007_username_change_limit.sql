-- Limit how many times a username / showroom handle may be changed.
-- The first assignment is free; afterwards at most 2 changes are allowed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changes smallint NOT NULL DEFAULT 0;
ALTER TABLE showrooms ADD COLUMN IF NOT EXISTS slug_changes smallint NOT NULL DEFAULT 0;
