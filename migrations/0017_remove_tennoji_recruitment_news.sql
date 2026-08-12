-- 天王寺動物園の「募集情報」カテゴリ(職員採用等)の記事を、
-- 既に取り込み済みのお知らせから削除する。(#148)
DELETE FROM zoo_news_animals
WHERE news_id IN (
  SELECT id FROM zoo_news
  WHERE zoo_id = 'tennoji-zoo'
    AND url LIKE 'https://www.tennojizoo.jp/new/%'
);

DELETE FROM zoo_news
WHERE zoo_id = 'tennoji-zoo'
  AND url LIKE 'https://www.tennojizoo.jp/new/%';
