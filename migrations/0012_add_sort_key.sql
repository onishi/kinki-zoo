ALTER TABLE animals ADD COLUMN sort_key TEXT;
ALTER TABLE zoo_animals ADD COLUMN sort_key TEXT;

-- Animals whose canonical_name is not readable as katakana
UPDATE animals SET sort_key = 'チャボ' WHERE canonical_name = '矮鶏';

-- Zoo animal display names not in katakana
UPDATE zoo_animals SET sort_key = 'ウサギ' WHERE display_name = 'うさぎ';
UPDATE zoo_animals SET sort_key = 'オオガタケン' WHERE display_name = '大型犬';
UPDATE zoo_animals SET sort_key = 'コガタケン' WHERE display_name = '小型犬';
