-- expense_documents에 company_id 컬럼 추가 (없으면) 및 기존 데이터 백필
-- 결재문서 회사별 조회가 정상 동작하려면 company_id가 필요함
-- 기존 전체 데이터는 첫 번째 회사(보통 언넌플랫폼 id=1)로 매핑

-- 1. company_id 컬럼 추가 (없으면)
ALTER TABLE expense_documents ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_expense_documents_company ON expense_documents(company_id);

-- 2. company_id가 NULL인 결재문서를 첫 번째 회사로 백필
--    (is_default 회사 우선, 없으면 id 최소값)
UPDATE expense_documents
SET company_id = (
  SELECT id FROM companies
  WHERE is_default = true
  LIMIT 1
)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM companies WHERE is_default = true);

UPDATE expense_documents
SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM companies LIMIT 1);
