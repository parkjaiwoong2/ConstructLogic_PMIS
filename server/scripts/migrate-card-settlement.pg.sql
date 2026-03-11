-- 카드정산 settled_at 컬럼 추가
-- 실행: psql $DATABASE_URL -f server/scripts/migrate-card-settlement.pg.sql

ALTER TABLE expense_documents ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_expense_documents_settled ON expense_documents(settled_at) WHERE settled_at IS NOT NULL;
