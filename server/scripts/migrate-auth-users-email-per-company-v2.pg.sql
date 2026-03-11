-- auth_users: 이메일 회사별 허용 (v2 - 다양한 제약 이름 대응)
-- 이메일 단독 UNIQUE 제약이 있으면 제거

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'auth_users'::regclass
      AND c.contype = 'u'
      AND a.attname = 'email'
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- 회사별 (company_id, email) 유일 인덱스
DROP INDEX IF EXISTS auth_users_company_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_company_email_key
  ON auth_users (COALESCE(company_id, 0), LOWER(TRIM(email)));
