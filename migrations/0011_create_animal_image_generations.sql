ALTER TABLE animal_images ADD COLUMN selected_generation_id INTEGER;

CREATE TABLE IF NOT EXISTS animal_image_generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  image_base64 TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1024,
  height INTEGER NOT NULL DEFAULT 1024,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_animal_image_generations_animal_key
  ON animal_image_generations (animal_key, created_at DESC);

INSERT INTO animal_image_generations (
  animal_key,
  display_name,
  normalized_name,
  prompt,
  model,
  mime_type,
  image_base64,
  width,
  height,
  created_at
)
SELECT
  animal_key,
  display_name,
  normalized_name,
  prompt,
  model,
  mime_type,
  image_base64,
  width,
  height,
  created_at
FROM animal_images
WHERE image_base64 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM animal_image_generations existing
    WHERE existing.animal_key = animal_images.animal_key
  );

UPDATE animal_images
SET selected_generation_id = (
  SELECT id
  FROM animal_image_generations
  WHERE animal_image_generations.animal_key = animal_images.animal_key
  ORDER BY id DESC
  LIMIT 1
)
WHERE selected_generation_id IS NULL;
