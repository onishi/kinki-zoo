-- 動物プロフィールの生成・レビューで対象の種を学名で特定する（和名だけだと似た名前の別種と取り違える）。
ALTER TABLE animals ADD COLUMN scientific_name TEXT;
