-- Construct Logic PMIS - PostgreSQL (Supabase) Schema

-- 회사 정보 (관리자 등록, 멀티 지원)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  ceo_name TEXT,
  founded_date TEXT,
  business_reg_no TEXT,
  tel TEXT,
  fax TEXT,
  email TEXT,
  copyright_text TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 로그인 사용자 (작성자/검토자/승인자/CEO/관리자)
CREATE TABLE IF NOT EXISTS auth_users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author',
  is_admin BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_company ON auth_users(company_id);

-- 역할 마스터 (추가/수정/삭제)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);

-- 역할별 메뉴 권한
CREATE TABLE IF NOT EXISTS role_menus (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  menu_path TEXT NOT NULL,
  UNIQUE(role, menu_path)
);

-- 회사별 결재 순서 (role, sort_order)
CREATE TABLE IF NOT EXISTS approval_sequences (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_approval_sequences_company ON approval_sequences(company_id, sort_order);

-- 회사 설정 (자동승인)
CREATE TABLE IF NOT EXISTS company_settings (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id),
  auto_approve BOOLEAN DEFAULT false
);

-- 계정과목 마스터 (항목)
CREATE TABLE IF NOT EXISTS account_items (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES account_items(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 현장(공사) 마스터
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 사용자 (로그인 차후 연동)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 결재 문서 (카드및현금사용 1건 = 1문서)
CREATE TABLE IF NOT EXISTS expense_documents (
  id SERIAL PRIMARY KEY,
  doc_no TEXT UNIQUE,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  project_name TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  card_no TEXT,
  status TEXT DEFAULT 'draft',
  total_card_amount INTEGER DEFAULT 0,
  total_cash_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul'),
  updated_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 카드/현금 사용내역 상세
CREATE TABLE IF NOT EXISTS expense_items (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES expense_documents(id) ON DELETE CASCADE,
  use_date TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  project_name TEXT NOT NULL,
  account_item_id INTEGER REFERENCES account_items(id),
  account_item_name TEXT NOT NULL,
  description TEXT,
  card_amount INTEGER DEFAULT 0,
  cash_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 결재 이력
CREATE TABLE IF NOT EXISTS approval_history (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES expense_documents(id),
  approver_name TEXT NOT NULL,
  sequence INTEGER DEFAULT 1,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 세부사용내역 -> 항목 자동매핑 규칙
CREATE TABLE IF NOT EXISTS account_mapping_rules (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  account_item_id INTEGER REFERENCES account_items(id),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 사용자별 카드 (멀티 등록, 기본 설정)
CREATE TABLE IF NOT EXISTS user_cards (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  user_name TEXT NOT NULL,
  card_no TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);
CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_name);
CREATE INDEX IF NOT EXISTS idx_user_cards_company ON user_cards(company_id);

-- 관리자 수정 이력
CREATE TABLE IF NOT EXISTS admin_edit_history (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES expense_documents(id),
  admin_user_id INTEGER REFERENCES auth_users(id),
  admin_name TEXT NOT NULL,
  document_status TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);
CREATE INDEX IF NOT EXISTS idx_admin_edit_history_document ON admin_edit_history(document_id);
CREATE INDEX IF NOT EXISTS idx_admin_edit_history_created ON admin_edit_history(created_at DESC);

-- 사용자별 기본 설정 (기본 현장)
CREATE TABLE IF NOT EXISTS user_settings (
  user_name TEXT PRIMARY KEY,
  default_project_id INTEGER REFERENCES projects(id),
  updated_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

CREATE INDEX IF NOT EXISTS idx_expense_items_document ON expense_items(document_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_date ON expense_items(use_date);
CREATE INDEX IF NOT EXISTS idx_expense_items_project ON expense_items(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_account ON expense_items(account_item_id);

-- auth_users 확장 (기존 마이그레이션)
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS project_id INTEGER;
UPDATE auth_users SET is_approved = true WHERE is_admin = true;

-- 회사 상세정보 (기존 테이블 마이그레이션)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ceo_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founded_date TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_reg_no TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tel TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fax TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS copyright_text TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
UPDATE companies SET is_default = true WHERE id = (SELECT id FROM companies ORDER BY id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM companies WHERE is_default = true);

-- 카드정산 settled_at (기존 테이블 마이그레이션)
ALTER TABLE expense_documents ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_expense_documents_settled ON expense_documents(settled_at) WHERE settled_at IS NOT NULL;

-- 법인카드 마스터 (회사별)
CREATE TABLE IF NOT EXISTS corporate_cards (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  card_no TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul'),
  UNIQUE(company_id, card_no)
);
CREATE INDEX IF NOT EXISTS idx_corporate_cards_company ON corporate_cards(company_id);

-- account_items, projects 회사별 (company_id 추가)
ALTER TABLE account_items ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
-- account_items code: 전역 UNIQUE -> (company_id, code) 회사별 UNIQUE
ALTER TABLE account_items DROP CONSTRAINT IF EXISTS account_items_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS account_items_company_code_key ON account_items (COALESCE(company_id, 0), code);
-- projects code: 전역 UNIQUE -> (company_id, code) 회사별 UNIQUE
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_key ON projects (COALESCE(company_id, 0), COALESCE(code, ''));

-- 슈퍼관리자용 마스터 템플릿 (신규 회사 생성 시 마이그레이션)
CREATE TABLE IF NOT EXISTS master_templates_account_items (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);
CREATE TABLE IF NOT EXISTS master_templates_projects (
  id SERIAL PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 사용자-회사 다중 소속 (auth_users.company_id + auth_user_companies)
CREATE TABLE IF NOT EXISTS auth_user_companies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth_users(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  UNIQUE(user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_user_companies_user ON auth_user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_companies_company ON auth_user_companies(company_id);

-- role_menus 회사별 (역할권한 회사별)
ALTER TABLE role_menus ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE role_menus SET company_id = (SELECT id FROM companies WHERE is_default = true ORDER BY id LIMIT 1) WHERE company_id IS NULL;
UPDATE role_menus SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1) WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies LIMIT 1);
ALTER TABLE role_menus DROP CONSTRAINT IF EXISTS role_menus_role_menu_path_key;
CREATE UNIQUE INDEX IF NOT EXISTS role_menus_company_role_menu_key ON role_menus (company_id, role, menu_path);
CREATE INDEX IF NOT EXISTS idx_role_menus_company ON role_menus(company_id);
-- 기존 역할권한을 다른 회사에 복사
INSERT INTO role_menus (company_id, role, menu_path)
  SELECT c.id, rm.role, rm.menu_path FROM companies c
  CROSS JOIN (SELECT role, menu_path FROM role_menus WHERE company_id = (SELECT id FROM companies WHERE is_default = true LIMIT 1)) rm
  WHERE c.id != (SELECT id FROM companies WHERE is_default = true LIMIT 1)
  ON CONFLICT (company_id, role, menu_path) DO NOTHING;

-- user_cards company_id (멀티회사 지원)
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_user_cards_company ON user_cards(company_id);
UPDATE user_cards uc SET company_id = au.company_id FROM auth_users au WHERE au.name = uc.user_name AND uc.company_id IS NULL;
UPDATE user_cards SET company_id = (SELECT id FROM companies WHERE is_default = true LIMIT 1) WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies LIMIT 1);

-- role_menus: 회사 삭제 시 CASCADE (companies 삭제 시 role_menus 자동 삭제)
ALTER TABLE role_menus DROP CONSTRAINT IF EXISTS role_menus_company_id_fkey;
ALTER TABLE role_menus ADD CONSTRAINT role_menus_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- /admin/users, /admin/role-permissions -> /admin/permissions 통합
INSERT INTO role_menus (company_id, role, menu_path)
  SELECT DISTINCT company_id, role, '/admin/permissions' FROM role_menus
  WHERE menu_path IN ('/admin/users', '/admin/role-permissions')
  ON CONFLICT (company_id, role, menu_path) DO NOTHING;
DELETE FROM role_menus WHERE menu_path IN ('/admin/users', '/admin/role-permissions');

-- /documents, /approval -> /approval-processing 통합
INSERT INTO role_menus (company_id, role, menu_path)
  SELECT DISTINCT company_id, role, '/approval-processing' FROM role_menus
  WHERE menu_path IN ('/documents', '/approval')
  ON CONFLICT (company_id, role, menu_path) DO NOTHING;
DELETE FROM role_menus WHERE menu_path IN ('/documents', '/approval');

-- /admin/approval-sequence -> /settings 통합 (설정 메뉴에 결재순서 탭 포함)
INSERT INTO role_menus (company_id, role, menu_path)
  SELECT DISTINCT company_id, role, '/settings' FROM role_menus
  WHERE menu_path = '/admin/approval-sequence'
  ON CONFLICT (company_id, role, menu_path) DO NOTHING;
DELETE FROM role_menus WHERE menu_path = '/admin/approval-sequence';

-- /card-settlement, /admin/corporate-cards -> /card-management 통합
INSERT INTO role_menus (company_id, role, menu_path)
  SELECT DISTINCT company_id, role, '/card-management' FROM role_menus
  WHERE menu_path IN ('/card-settlement', '/admin/corporate-cards')
  ON CONFLICT (company_id, role, menu_path) DO NOTHING;
DELETE FROM role_menus WHERE menu_path IN ('/card-settlement', '/admin/corporate-cards');

-- roles 회사별 (회사별 역할 등록/조회)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE roles SET company_id = (SELECT id FROM companies WHERE is_default = true ORDER BY id LIMIT 1)
WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies LIMIT 1);
UPDATE roles SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies LIMIT 1);
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_code_key;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_company_code_key;
ALTER TABLE roles ADD CONSTRAINT roles_company_code_key UNIQUE (company_id, code);
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);
