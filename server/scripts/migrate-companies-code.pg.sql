-- companies 테이블에 code 컬럼 추가 및 기존 데이터 백필
-- 회사구분용 코드 (COMP0001, COMP0002 형식)

ALTER TABLE companies ADD COLUMN IF NOT EXISTS code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS companies_code_key ON companies(code) WHERE code IS NOT NULL;

-- 기존 회사에 code 자동생성 (COMP + id 4자리)
UPDATE companies
SET code = 'COMP' || LPAD(id::text, 4, '0')
WHERE code IS NULL;

-- NOT NULL 제약은 백필 후 적용 (신규는 API에서 생성)
-- ALTER TABLE companies ALTER COLUMN code SET NOT NULL;
