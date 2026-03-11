-- expense_documents: company_id NULL → 언넌플랫폼으로 백필 후 NOT NULL 적용
-- 문서는 반드시 회사 소속이어야 함

-- 1) company_id가 NULL인 결재문서를 언넌플랫폼으로 업데이트
UPDATE expense_documents
SET company_id = (SELECT id FROM companies WHERE name = '언넌플랫폼' LIMIT 1)
WHERE company_id IS NULL;

-- 2) 언넌플랫폼이 없으면 is_default 회사 사용
UPDATE expense_documents
SET company_id = (SELECT id FROM companies WHERE is_default = true LIMIT 1)
WHERE company_id IS NULL;

-- 3) 그래도 null 있으면 첫 번째 회사
UPDATE expense_documents
SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM companies LIMIT 1);

-- 4) company_id NOT NULL 제약 추가
-- (NULL이 남아있으면 실패 - 먼저 companies 테이블에 회사가 있는지 확인)
ALTER TABLE expense_documents
  ALTER COLUMN company_id SET NOT NULL;
