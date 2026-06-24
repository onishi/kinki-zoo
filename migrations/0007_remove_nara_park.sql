DELETE FROM zoo_animals
WHERE zoo_id = 'nara-koen-deer';

DELETE FROM animal_scrape_results
WHERE zoo_id = 'nara-koen-deer';

DELETE FROM animals
WHERE id NOT IN (
  SELECT DISTINCT animal_id
  FROM zoo_animals
  WHERE animal_id IS NOT NULL
);
