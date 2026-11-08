CREATE TABLE applications (
  id TEXT PRIMARY KEY NOT NULL,
  submitted_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  course TEXT NOT NULL,
  answers_json TEXT NOT NULL
) STRICT;

CREATE INDEX applications_submitted_at_idx
  ON applications(submitted_at);
