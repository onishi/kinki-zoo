CREATE TABLE IF NOT EXISTS animal_images (
  animal_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  image_base64 TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1024,
  height INTEGER NOT NULL DEFAULT 1024,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_animal_images_normalized_name
  ON animal_images (normalized_name);
