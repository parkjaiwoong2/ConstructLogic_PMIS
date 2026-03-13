-- company_id NULL 백필 및 NOT NULL 적용
-- 기본 회사: is_default=true 또는 '언넌플랫폼' 또는 첫 번째 회사

DO $$
DECLARE
  default_cid INTEGER;
BEGIN
  SELECT id INTO default_cid FROM companies WHERE is_default = true ORDER BY id LIMIT 1;
  IF default_cid IS NULL THEN
    SELECT id INTO default_cid FROM companies WHERE name = '언넌플랫폼' LIMIT 1;
  END IF;
  IF default_cid IS NULL THEN
    SELECT id INTO default_cid FROM companies ORDER BY id LIMIT 1;
  END IF;
  IF default_cid IS NULL THEN
    RAISE EXCEPTION 'companies 테이블에 회사가 없습니다.';
  END IF;

  -- 1) auth_users
  UPDATE auth_users SET company_id = default_cid WHERE company_id IS NULL;

  -- 2) approval_sequences
  UPDATE approval_sequences SET company_id = default_cid WHERE company_id IS NULL;

  -- 3) account_items
  UPDATE account_items SET company_id = default_cid WHERE company_id IS NULL;

  -- 4) projects
  UPDATE projects SET company_id = default_cid WHERE company_id IS NULL;

  -- 5) expense_documents
  UPDATE expense_documents SET company_id = default_cid WHERE company_id IS NULL;

  -- 6) user_cards
  UPDATE user_cards SET company_id = default_cid WHERE company_id IS NULL;

  -- 7) role_menus: NULL이면 기본 회사로. 중복 시 삭제 (아래 별도 처리)
  DELETE FROM role_menus a USING role_menus b
    WHERE a.id > b.id AND a.company_id IS NULL AND b.company_id IS NULL
      AND a.role = b.role AND a.menu_path = b.menu_path;
  UPDATE role_menus SET company_id = default_cid WHERE company_id IS NULL;

  -- 8) roles: NULL이면 기본 회사로. 중복 시 1건만 유지
  DELETE FROM roles a USING roles b
    WHERE a.id > b.id AND a.company_id IS NULL AND b.company_id IS NULL AND a.code = b.code;
  UPDATE roles SET company_id = default_cid WHERE company_id IS NULL;

END $$;

-- NOT NULL 제약 추가
ALTER TABLE auth_users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE approval_sequences ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE account_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE expense_documents ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE user_cards ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE role_menus ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE roles ALTER COLUMN company_id SET NOT NULL;
