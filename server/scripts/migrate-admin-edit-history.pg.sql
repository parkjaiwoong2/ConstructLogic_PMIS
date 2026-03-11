-- 관리자 수정 히스토리 테이블 (기존 DB 마이그레이션)
-- 실행: psql $DATABASE_URL -f server/scripts/migrate-admin-edit-history.pg.sql

CREATE TABLE IF NOT EXISTS admin_edit_history (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES expense_documents(id),
  admin_user_id INTEGER REFERENCES auth_users(id),
  admin_name TEXT NOT NULL,
  document_status TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);
CREATE INDEX IF NOT EXISTS idx_admin_edit_history_document ON admin_edit_history(document_id);
CREATE INDEX IF NOT EXISTS idx_admin_edit_history_created ON admin_edit_history(created_at DESC);
