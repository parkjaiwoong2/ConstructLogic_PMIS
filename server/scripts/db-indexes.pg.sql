-- DB 인덱스 튜닝 (쿼리 패턴 기반)
-- Supabase SQL Editor에서 실행 또는: node -e "require('./server/db').pool.query(require('fs').readFileSync('./server/scripts/db-indexes.pg.sql','utf8'))"

-- companies: 회사등록 화면 (ORDER BY is_default DESC, id / WHERE is_default = true)
CREATE INDEX IF NOT EXISTS idx_companies_order ON companies(is_default DESC NULLS LAST, id);
CREATE INDEX IF NOT EXISTS idx_companies_default ON companies(id) WHERE is_default = true;

-- company_settings: company_id가 PK라 별도 인덱스 불필요

-- expense_documents: 목록 조회(필터, 정렬)
CREATE INDEX IF NOT EXISTS idx_expense_documents_status ON expense_documents(status);
CREATE INDEX IF NOT EXISTS idx_expense_documents_created ON expense_documents(created_at DESC);

-- expense_items: 사용내역 조회 정렬
CREATE INDEX IF NOT EXISTS idx_expense_items_use_date_desc ON expense_items(use_date DESC, id DESC);

-- auth_users: 사용자권한 목록 조회 (필터, 정렬)
CREATE INDEX IF NOT EXISTS idx_auth_users_project ON auth_users(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_list_order ON auth_users(is_approved ASC, created_at DESC NULLS LAST);

-- approval_sequences: 결재순서 조회
CREATE INDEX IF NOT EXISTS idx_approval_sequences_company ON approval_sequences(company_id, sort_order);
