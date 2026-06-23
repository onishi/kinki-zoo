CREATE TABLE IF NOT EXISTS animal_taxonomy_candidates (
  display_name TEXT PRIMARY KEY,
  canonical_name TEXT,
  class_name TEXT,
  order_name TEXT,
  family_name TEXT,
  genus_name TEXT,
  species_name TEXT,
  confidence REAL NOT NULL,
  reason TEXT,
  sources_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  model TEXT NOT NULL,
  grounded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_animal_taxonomy_candidates_status
  ON animal_taxonomy_candidates (status);

CREATE INDEX IF NOT EXISTS idx_animal_taxonomy_candidates_confidence
  ON animal_taxonomy_candidates (confidence);
