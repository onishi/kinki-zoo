-- Backfill readings for names that SQLite cannot order phonetically.
UPDATE animals SET sort_key = 'オオガタケン' WHERE canonical_name = '大型犬';
UPDATE animals SET sort_key = 'コガタケン' WHERE canonical_name = '小型犬';
UPDATE animals SET sort_key = 'チャボ' WHERE canonical_name = '矮鶏';

UPDATE zoo_animals SET sort_key = 'オオガタケン' WHERE display_name = '大型犬';
UPDATE zoo_animals SET sort_key = 'コガタケン' WHERE display_name = '小型犬';
UPDATE zoo_animals SET sort_key = 'チャボ' WHERE display_name = '矮鶏';
