PRAGMA foreign_keys = off;

UPDATE zoo_animals SET animal_id = NULL;

DROP TABLE IF EXISTS animals;

CREATE TABLE animals (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  order_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  genus_name TEXT NOT NULL,
  species_name TEXT NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (genus_name, species_name)
);

CREATE INDEX IF NOT EXISTS idx_animals_taxonomy ON animals (
  class_name,
  order_name,
  family_name,
  genus_name,
  species_name
);

CREATE INDEX IF NOT EXISTS idx_animals_species ON animals (species_name);

PRAGMA foreign_keys = on;
