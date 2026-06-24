UPDATE animals
SET order_name = CASE order_name
  WHEN 'インコ目' THEN 'オウム目'
  WHEN 'ガンカモ目' THEN 'カモ目'
  WHEN 'サル目' THEN '霊長目'
  WHEN 'ネコ目' THEN '食肉目'
  WHEN '兎形目' THEN 'ウサギ目'
  WHEN '偶蹄目' THEN '鯨偶蹄目'
  ELSE order_name
END
WHERE order_name IN ('インコ目', 'ガンカモ目', 'サル目', 'ネコ目', '兎形目', '偶蹄目');

UPDATE animal_taxonomy_candidates
SET order_name = CASE order_name
  WHEN 'インコ目' THEN 'オウム目'
  WHEN 'ガンカモ目' THEN 'カモ目'
  WHEN 'サル目' THEN '霊長目'
  WHEN 'ネコ目' THEN '食肉目'
  WHEN '兎形目' THEN 'ウサギ目'
  WHEN '偶蹄目' THEN '鯨偶蹄目'
  ELSE order_name
END,
updated_at = datetime('now')
WHERE order_name IN ('インコ目', 'ガンカモ目', 'サル目', 'ネコ目', '兎形目', '偶蹄目');
