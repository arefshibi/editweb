-- Every account gets a public id used in its address: /account/<username>.
-- Until the owner picks their own, it is the auto id  user-<random 1..99999>  (shown as "User-48213").
-- username_auto = true  => the first self-chosen username is free (does not count against the 2-change limit).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_auto boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  r record;
  cand text;
  tries int;
BEGIN
  FOR r IN SELECT id FROM users WHERE username IS NULL LOOP
    tries := 0;
    LOOP
      tries := tries + 1;
      -- widen the range if the 1..99999 space ever gets crowded
      cand := 'user-' || lpad((1 + floor(random() * (CASE WHEN tries > 30 THEN 9999999 ELSE 99999 END)))::int::text, 2, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE lower(username) = cand);
    END LOOP;
    UPDATE users SET username = cand, username_auto = true WHERE id = r.id;
  END LOOP;
END $$;
