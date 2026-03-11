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
  user_name TEXT NOT NULL,
  card_no TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);
CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_name);

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
