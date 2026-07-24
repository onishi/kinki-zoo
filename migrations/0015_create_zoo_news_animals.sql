ALTER TABLE zoo_news ADD COLUMN body TEXT;

CREATE TABLE IF NOT EXISTS zoo_news_animals (
  news_id INTEGER NOT NULL REFERENCES zoo_news(id) ON DELETE CASCADE,
  animal_name TEXT NOT NULL,
  PRIMARY KEY (news_id, animal_name)
);

CREATE INDEX IF NOT EXISTS idx_zoo_news_animals_name
  ON zoo_news_animals (animal_name);
