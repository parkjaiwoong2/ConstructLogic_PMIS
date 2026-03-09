-- Construct Logic PMIS - PostgreSQL (Supabase) Schema

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

CREATE INDEX IF NOT EXISTS idx_expense_items_document ON expense_items(document_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_date ON expense_items(use_date);
CREATE INDEX IF NOT EXISTS idx_expense_items_project ON expense_items(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_account ON expense_items(account_item_id);
