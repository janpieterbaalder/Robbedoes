CREATE TABLE IF NOT EXISTS saved_matches (
  user_id text NOT NULL,
  match_id text NOT NULL,
  match jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);
-- Only the authenticated Next.js server accesses this table. Never expose a database URL to the browser.
ALTER TABLE saved_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saved_matches FROM PUBLIC;
