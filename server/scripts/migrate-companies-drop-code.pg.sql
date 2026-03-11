-- companies 테이블에서 code 컬럼 제거
-- 회사는 id로 구분, code(COMP0001) 제거

DROP INDEX IF EXISTS companies_code_key;
ALTER TABLE companies DROP COLUMN IF EXISTS code;
