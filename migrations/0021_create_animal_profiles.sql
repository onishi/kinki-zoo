-- 種ごとのプロフィール（解説・保全状況）、数値データ、出典
CREATE TABLE IF NOT EXISTS animal_profiles (
  animal_id TEXT PRIMARY KEY REFERENCES animals(id) ON DELETE CASCADE,
  scientific_name TEXT,
  english_name TEXT,
  summary TEXT,
  description TEXT,
  habitat TEXT,
  distribution_regions TEXT,
  diet TEXT,
  diet_type TEXT CHECK (diet_type IN ('carnivore','herbivore','omnivore','insectivore','piscivore','other')),
  activity_pattern TEXT CHECK (activity_pattern IN ('diurnal','nocturnal','crepuscular','cathemeral')),
  social_structure TEXT CHECK (social_structure IN ('solitary','pair','group','colony')),
  viewing_tips TEXT,
  trivia TEXT,
  iucn_status TEXT CHECK (iucn_status IN ('EX','EW','CR','EN','VU','NT','LC','DD','NE')),
  iucn_assessed_year INTEGER,
  moe_redlist_category TEXT,
  cites_appendix TEXT CHECK (cites_appendix IN ('I','II','III')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reviewed','published','rejected')),
  model TEXT,
  generated_at TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_animal_profiles_status ON animal_profiles (status);
CREATE INDEX IF NOT EXISTS idx_animal_profiles_iucn ON animal_profiles (iucn_status);

CREATE TABLE IF NOT EXISTS animal_profile_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  publisher TEXT,
  accessed_at TEXT NOT NULL,
  UNIQUE (animal_id, url)
);

CREATE TABLE IF NOT EXISTS animal_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  sex TEXT NOT NULL DEFAULT 'any' CHECK (sex IN ('any','male','female')),
  context TEXT NOT NULL DEFAULT 'any' CHECK (context IN ('any','wild','captive')),
  min_value REAL,
  max_value REAL,
  unit TEXT NOT NULL CHECK (unit IN ('cm','kg','year','day','count')),
  note TEXT,
  source_id INTEGER REFERENCES animal_profile_sources(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (min_value IS NOT NULL OR max_value IS NOT NULL),
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value),
  UNIQUE (animal_id, metric, sex, context)
);

CREATE INDEX IF NOT EXISTS idx_animal_measurements_metric
  ON animal_measurements (metric, max_value);
