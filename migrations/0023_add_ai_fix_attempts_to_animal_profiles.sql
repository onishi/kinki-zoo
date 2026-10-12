-- AI レビューで保留になった下書きを、指摘を渡して自動で作り直した回数。
-- 上限に達したら作り直さず、人の確認を待つ。人が下書きを作り直したら 0 に戻す。
ALTER TABLE animal_profiles ADD COLUMN ai_fix_attempts INTEGER NOT NULL DEFAULT 0;
