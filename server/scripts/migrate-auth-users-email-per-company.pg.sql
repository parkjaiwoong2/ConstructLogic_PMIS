-- auth_users: 이메일을 회사별로 허용 (같은 이메일이 다른 회사에서 사용 가능)
-- 기존: email UNIQUE (전역 1개)
-- 변경: (company_id, email) 회사별 유일

ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_company_email_key
  ON auth_users (COALESCE(company_id, 0), LOWER(TRIM(email)));
