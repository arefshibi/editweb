CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category varchar(24) NOT NULL CHECK (category IN ('general','account','listing','payment','security','other')),
  subject varchar(120) NOT NULL,
  body varchar(4000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(subject) BETWEEN 4 AND 120),
  CHECK (length(body) BETWEEN 10 AND 4000)
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_open_idx ON support_tickets(status, created_at DESC);
