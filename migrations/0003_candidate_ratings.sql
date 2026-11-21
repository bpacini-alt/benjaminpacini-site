-- Candidate names and rubric ratings for the password-protected review pages.
-- The worker also creates these tables on first use, so this file is a record.
CREATE TABLE IF NOT EXISTS candidate_codes (
  application_id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  assigned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_ratings (
  rater_key TEXT NOT NULL,
  rater_label TEXT NOT NULL,
  application_id TEXT NOT NULL,
  criterion TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (rater_key, application_id, criterion)
);
