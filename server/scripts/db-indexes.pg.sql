-- DB 인덱스 튜닝 (쿼리 패턴 기반)
-- Supabase SQL Editor에서 실행 또는: node -e "require('./server/db').pool.query(require('fs').readFileSync('./server/scripts/db-indexes.pg.sql','utf8'))"

-- expense_documents: 목록 조회(필터, 정렬)
CREATE INDEX IF NOT EXISTS idx_expense_documents_status ON expense_documents(status);
CREATE INDEX IF NOT EXISTS idx_expense_documents_created ON expense_documents(created_at DESC);

-- expense_items: 사용내역 조회 정렬
CREATE INDEX IF NOT EXISTS idx_expense_items_use_date_desc ON expense_items(use_date DESC, id DESC);
