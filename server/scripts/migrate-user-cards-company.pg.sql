-- user_cards 회사(company_id) 컬럼 추가 (멀티회사 지원)
-- 실행: node server/scripts/run-migrate-user-cards-company.js
-- 또는: psql $DATABASE_URL -f server/scripts/migrate-user-cards-company.pg.sql

ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_user_cards_company ON user_cards(company_id);

-- user_name으로 auth_users와 매칭하여 company_id 백필
UPDATE user_cards uc
SET company_id = au.company_id
FROM auth_users au
WHERE au.name = uc.user_name
  AND uc.company_id IS NULL;

-- 매칭 안 된 카드는 대표회사로
UPDATE user_cards
SET company_id = (SELECT id FROM companies WHERE is_default = true LIMIT 1)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM companies LIMIT 1);
