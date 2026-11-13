-- 023: founding members — the first 15 approved showrooms get a numbered badge
ALTER TABLE showrooms ADD COLUMN IF NOT EXISTS founding_number smallint;
CREATE UNIQUE INDEX IF NOT EXISTS showrooms_founding_number_uniq ON showrooms(founding_number) WHERE founding_number IS NOT NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY COALESCE(verified_at, created_at), created_at, id) AS n
  FROM showrooms WHERE status = 'approved' AND founding_number IS NULL
)
UPDATE showrooms s SET founding_number = r.n
FROM ranked r
WHERE s.id = r.id AND r.n <= 15
  AND NOT EXISTS (SELECT 1 FROM showrooms x WHERE x.founding_number IS NOT NULL);
