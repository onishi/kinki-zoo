CREATE TABLE IF NOT EXISTS animal_scrape_results (
  zoo_id TEXT PRIMARY KEY,
  scraped_at TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS zoo_animals (
  zoo_id TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  PRIMARY KEY (zoo_id, name)
);

CREATE INDEX IF NOT EXISTS idx_zoo_animals_zoo_id ON zoo_animals (zoo_id);
CREATE INDEX IF NOT EXISTS idx_zoo_animals_normalized_name ON zoo_animals (normalized_name);
