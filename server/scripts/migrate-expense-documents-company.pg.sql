-- expense_documents에 company_id 추가 (user_name이 auth_users에 없을 때도 회사별 조회 가능)
ALTER TABLE expense_documents ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_expense_documents_company ON expense_documents(company_id);
