INSERT OR IGNORE INTO animals (
  id,
  canonical_name,
  normalized_name,
  class_name,
  order_name,
  family_name,
  genus_name,
  species_name,
  notes,
  updated_at
)
VALUES
  (
    'domestic-guinea-pig',
    'モルモット',
    'モルモット',
    '哺乳類',
    '齧歯目',
    'テンジクネズミ科',
    'テンジクネズミ属',
    'モルモット',
    NULL,
    datetime('now')
  ),
  (
    'sheep',
    'ヒツジ',
    'ヒツジ',
    '哺乳類',
    '鯨偶蹄目',
    'ウシ科',
    'ヒツジ属',
    'ヒツジ',
    NULL,
    datetime('now')
  );

UPDATE zoo_animals
SET animal_id = (
  SELECT id FROM animals WHERE canonical_name = 'モルモット'
)
WHERE animal_id IS NULL
  AND display_name LIKE 'テンジクネズミ%';

UPDATE zoo_animals
SET animal_id = (
  SELECT id FROM animals WHERE canonical_name = 'ヒツジ'
)
WHERE animal_id IS NULL
  AND display_name LIKE 'ヒツジ%';
