UPDATE zoo_animals
SET animal_id = (
  SELECT a.id
  FROM animal_taxonomy_candidates c
  JOIN animals a
    ON a.canonical_name = c.canonical_name
    OR (
      a.genus_name = c.genus_name
      AND a.species_name = c.species_name
    )
  WHERE c.display_name = zoo_animals.display_name
    AND c.status = 'applied'
  LIMIT 1
)
WHERE animal_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM animal_taxonomy_candidates c
    JOIN animals a
      ON a.canonical_name = c.canonical_name
      OR (
        a.genus_name = c.genus_name
        AND a.species_name = c.species_name
      )
    WHERE c.display_name = zoo_animals.display_name
      AND c.status = 'applied'
  );
