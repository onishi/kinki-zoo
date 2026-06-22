CREATE TABLE IF NOT EXISTS animals (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  class_name TEXT,
  order_name TEXT,
  family_name TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_animals_normalized_name ON animals (normalized_name);
CREATE INDEX IF NOT EXISTS idx_animals_taxonomy ON animals (class_name, order_name, family_name);

CREATE TABLE zoo_animals_new (
  zoo_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  normalized_display_name TEXT NOT NULL,
  animal_id TEXT,
  PRIMARY KEY (zoo_id, display_name),
  FOREIGN KEY (animal_id) REFERENCES animals(id)
);

INSERT INTO zoo_animals_new (zoo_id, display_name, normalized_display_name)
SELECT zoo_id, name, normalized_name
FROM zoo_animals;

DROP TABLE zoo_animals;
ALTER TABLE zoo_animals_new RENAME TO zoo_animals;

CREATE INDEX IF NOT EXISTS idx_zoo_animals_zoo_id ON zoo_animals (zoo_id);
CREATE INDEX IF NOT EXISTS idx_zoo_animals_normalized_display_name ON zoo_animals (normalized_display_name);
CREATE INDEX IF NOT EXISTS idx_zoo_animals_animal_id ON zoo_animals (animal_id);
