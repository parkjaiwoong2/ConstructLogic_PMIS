-- roles 테이블에 company_id 추가 (회사별 역할)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- 기존 역할에 기본 회사 할당
UPDATE roles SET company_id = (SELECT id FROM companies WHERE is_default = true ORDER BY id LIMIT 1)
WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies LIMIT 1);
UPDATE roles SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies LIMIT 1);

-- code 전역 UNIQUE 제거, (company_id, code) 회사별 UNIQUE로 변경
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_code_key;
ALTER TABLE roles ADD CONSTRAINT roles_company_code_key UNIQUE (company_id, code);
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);
