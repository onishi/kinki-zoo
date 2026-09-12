-- 実行計画でフルスキャンになっていた検索条件にインデックスを追加する。

-- zoo_animals の主キーは (zoo_id, display_name) のため、display_name 単独の
-- 絞り込み（/animal/:displayName の詳細・関連表示名の取得）はフルスキャンになる。
CREATE INDEX IF NOT EXISTS idx_zoo_animals_display_name
  ON zoo_animals (display_name);

-- 展示終了の推定は previous_display_name で絞り込むが、既存インデックスは
-- 選択性の低い diff_type 単独のため効かない。
CREATE INDEX IF NOT EXISTS idx_animal_scrape_diffs_previous_display_name
  ON animal_scrape_diffs (previous_display_name, diff_type);

-- 施設横断のお知らせ一覧は published_at だけで並べ替えるため、
-- zoo_id 先頭の既存インデックスでは並べ替えを省略できない。
CREATE INDEX IF NOT EXISTS idx_zoo_news_published
  ON zoo_news (published_at DESC);
