ALTER TABLE animals ADD COLUMN genus_name TEXT;
ALTER TABLE animals ADD COLUMN species_name TEXT;

DROP INDEX IF EXISTS idx_animals_taxonomy;
CREATE INDEX IF NOT EXISTS idx_animals_taxonomy ON animals (
  class_name,
  order_name,
  family_name,
  genus_name,
  species_name
);
