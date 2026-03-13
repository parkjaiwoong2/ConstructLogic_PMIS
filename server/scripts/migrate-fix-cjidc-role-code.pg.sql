-- 케이제이아이디씨(주) 회사의 역할 코드 '관리자' -> 'admin' 변경
-- role_menus, auth_users, approval_sequences, roles 순서로 업데이트
-- 실행: psql $DATABASE_URL -f server/scripts/migrate-fix-cjidc-role-code.pg.sql

DO $$
DECLARE
  cid INTEGER;
BEGIN
  SELECT id INTO cid FROM companies WHERE TRIM(name) = '케이제이아이디씨(주)' LIMIT 1;
  IF cid IS NULL THEN
    RAISE NOTICE '회사 "케이제이아이디씨(주)" 를 찾을 수 없습니다.';
    RETURN;
  END IF;

  -- role_menus
  UPDATE role_menus SET role = 'admin' WHERE company_id = cid AND role = '관리자';

  -- auth_users (해당 회사 소속 중 role=관리자)
  UPDATE auth_users SET role = 'admin' WHERE company_id = cid AND role = '관리자';
  UPDATE auth_users SET role = 'admin'
  WHERE role = '관리자' AND id IN (SELECT user_id FROM auth_user_companies WHERE company_id = cid);

  -- approval_sequences
  UPDATE approval_sequences SET role = 'admin' WHERE company_id = cid AND role = '관리자';

  -- roles
  UPDATE roles SET code = 'admin', label = '관리자' WHERE company_id = cid AND code = '관리자';

  RAISE NOTICE '케이제이아이디씨(주) role code 수정 완료: 관리자 -> admin';
END $$;
