-- 015: automatically ingested car news (RSS -> Persian title/summary -> served at GET /api/v1/news/items)
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS news_items (
  id varchar(64) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  source varchar(80) NOT NULL,
  url text NOT NULL UNIQUE,
  category varchar(40) NOT NULL,
  title varchar(300) NOT NULL,
  summary varchar(1200) NOT NULL DEFAULT '',
  image text NOT NULL,
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_items_published_idx ON news_items(published_at DESC);
