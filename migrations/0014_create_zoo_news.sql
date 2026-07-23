CREATE TABLE IF NOT EXISTS zoo_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zoo_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  UNIQUE(zoo_id, url)
);

CREATE INDEX IF NOT EXISTS idx_zoo_news_zoo_published
  ON zoo_news (zoo_id, published_at DESC);
