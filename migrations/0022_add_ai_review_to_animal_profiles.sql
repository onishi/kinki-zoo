-- 動物プロフィール下書きの AI レビュー結果。approve なら自動で公開し、hold なら指摘を残して人の確認を待つ。
-- 下書きを作り直したら（generated_at が更新されたら）クリアして再レビューの対象に戻す。
ALTER TABLE animal_profiles ADD COLUMN ai_review_verdict TEXT CHECK (ai_review_verdict IN ('approve', 'hold'));
ALTER TABLE animal_profiles ADD COLUMN ai_review_issues TEXT;
ALTER TABLE animal_profiles ADD COLUMN ai_review_model TEXT;
ALTER TABLE animal_profiles ADD COLUMN ai_reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_animal_profiles_ai_review ON animal_profiles (status, ai_reviewed_at);
