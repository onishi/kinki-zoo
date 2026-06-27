CREATE TABLE IF NOT EXISTS animal_scrape_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zoo_id TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  diff_type TEXT NOT NULL CHECK (diff_type IN ('added', 'removed', 'renamed')),
  previous_display_name TEXT,
  current_display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_animal_scrape_diffs_zoo_scraped_at
  ON animal_scrape_diffs (zoo_id, scraped_at);

CREATE INDEX IF NOT EXISTS idx_animal_scrape_diffs_diff_type
  ON animal_scrape_diffs (diff_type);
