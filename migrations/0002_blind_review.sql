ALTER TABLE applications ADD COLUMN blind_id TEXT;

UPDATE applications
SET blind_id = lower(hex(randomblob(16)))
WHERE blind_id IS NULL;

CREATE UNIQUE INDEX applications_blind_id_idx
  ON applications(blind_id);

CREATE TABLE blind_rankings (
  reviewer_key TEXT NOT NULL,
  reviewer_label TEXT NOT NULL,
  blind_id TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 100),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (reviewer_key, blind_id),
  UNIQUE (reviewer_key, rank),
  FOREIGN KEY (blind_id) REFERENCES applications(blind_id)
) STRICT;
