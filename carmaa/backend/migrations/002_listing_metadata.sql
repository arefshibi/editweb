-- Persist vehicle details that are specific to CarMaa's listing form.
-- Values are schema-validated by the API and stored as a JSON object only.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS listings_metadata_gin_idx
  ON listings USING gin (metadata jsonb_path_ops);
