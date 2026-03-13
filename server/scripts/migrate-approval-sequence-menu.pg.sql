-- 결재순서를 설정 메뉴에서 분리하여 /admin/approval-sequence 독립 메뉴로 추가
-- company_admin이 /admin/permissions를 가진 모든 회사에 /admin/approval-sequence 메뉴 부여
-- 실행: psql $DATABASE_URL -f server/scripts/migrate-approval-sequence-menu.pg.sql

INSERT INTO role_menus (company_id, role, menu_path)
  SELECT DISTINCT company_id, role, '/admin/approval-sequence'
  FROM role_menus
  WHERE role = 'company_admin' AND menu_path = '/admin/permissions'
  ON CONFLICT (company_id, role, menu_path) DO NOTHING;
