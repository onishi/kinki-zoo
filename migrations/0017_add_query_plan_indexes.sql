-- 主要ページのクエリ計画を確認して見つかった不足インデックスを追加する (#120)
--
-- zoo_animals の PRIMARY KEY は (zoo_id, display_name) で、先頭列が zoo_id のため
-- display_name だけで絞り込む検索は PK を使えず全件スキャンになっていた。
-- 動物詳細ページ (/animal/:displayName) の loadZooAnimalDetail・loadRelatedDisplayNames、
-- 分類適用の UPDATE (applyTaxonomyCandidate 系) がこのパターンで、アクセス頻度が高いため追加する。
CREATE INDEX IF NOT EXISTS idx_zoo_animals_display_name ON zoo_animals (display_name);

-- animal_scrape_diffs は (zoo_id, scraped_at) と (diff_type) 単独のインデックスしかなく、
-- 動物詳細ページの「過去に見られた動物園」表示 (loadAnimalPastZoos) が使う
-- `WHERE diff_type = 'removed' AND previous_display_name = ?` は diff_type 単独では
-- 絞り込みきれず SCAN になっていたため複合インデックスを追加する。
CREATE INDEX IF NOT EXISTS idx_animal_scrape_diffs_diff_type_previous_display_name
  ON animal_scrape_diffs (diff_type, previous_display_name);
