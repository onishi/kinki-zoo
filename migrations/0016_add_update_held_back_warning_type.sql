PRAGMA foreign_keys = off;

ALTER TABLE animal_scrape_warnings RENAME TO animal_scrape_warnings_old;

CREATE TABLE animal_scrape_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zoo_id TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  warning_type TEXT NOT NULL CHECK (
    warning_type IN (
      'scrape_error',
      'empty_result',
      'below_minimum',
      'sharp_drop',
      'high_removal_count',
      'update_held_back'
    )
  ),
  message TEXT NOT NULL,
  previous_count INTEGER,
  current_count INTEGER,
  threshold_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO animal_scrape_warnings (
  id, zoo_id, scraped_at, warning_type, message,
  previous_count, current_count, threshold_count, created_at
)
SELECT
  id, zoo_id, scraped_at, warning_type, message,
  previous_count, current_count, threshold_count, created_at
FROM animal_scrape_warnings_old;

DROP TABLE animal_scrape_warnings_old;

CREATE INDEX IF NOT EXISTS idx_animal_scrape_warnings_zoo_scraped_at
  ON animal_scrape_warnings (zoo_id, scraped_at);

CREATE INDEX IF NOT EXISTS idx_animal_scrape_warnings_type
  ON animal_scrape_warnings (warning_type);

PRAGMA foreign_keys = on;
