ALTER TABLE qa_questions ADD COLUMN IF NOT EXISTS category varchar(40) NOT NULL DEFAULT 'other';
ALTER TABLE qa_questions ADD COLUMN IF NOT EXISTS brand varchar(80);
ALTER TABLE qa_questions ADD COLUMN IF NOT EXISTS model varchar(80);
ALTER TABLE qa_questions ADD COLUMN IF NOT EXISTS vehicle_year varchar(8);
ALTER TABLE qa_questions ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0);
ALTER TABLE qa_answers ADD COLUMN IF NOT EXISTS helpful_count integer NOT NULL DEFAULT 0 CHECK (helpful_count >= 0);
CREATE TABLE IF NOT EXISTS qa_answer_votes (
  answer_id uuid NOT NULL REFERENCES qa_answers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(answer_id,user_id)
);
CREATE INDEX IF NOT EXISTS qa_answer_votes_user_idx ON qa_answer_votes(user_id,created_at DESC);
ALTER TABLE qa_questions ADD COLUMN IF NOT EXISTS image_id uuid REFERENCES images(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(254);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users(lower(username)) WHERE username IS NOT NULL;
ALTER TABLE showrooms ADD COLUMN IF NOT EXISTS owner_name varchar(80) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url text;
