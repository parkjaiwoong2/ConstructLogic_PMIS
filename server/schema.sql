-- 계정과목 마스터 (항목)
CREATE TABLE IF NOT EXISTS account_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES account_items(id),
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 현장(공사) 마스터
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 사용자 (로그인 차후 연동)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 결재 문서 (카드및현금사용 1건 = 1문서)
CREATE TABLE IF NOT EXISTS expense_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_no TEXT UNIQUE,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  project_name TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  card_no TEXT,
  status TEXT DEFAULT 'draft',  -- draft, pending, approved, rejected
  total_card_amount INTEGER DEFAULT 0,
  total_cash_amount INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 카드/현금 사용내역 상세
CREATE TABLE IF NOT EXISTS expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 결재 이력
CREATE TABLE IF NOT EXISTS approval_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES expense_documents(id),
  approver_name TEXT NOT NULL,
  sequence INTEGER DEFAULT 1,
  action TEXT NOT NULL,  -- approved, rejected
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 세부사용내역 -> 항목 자동매핑 규칙 (키워드 기반)
CREATE TABLE IF NOT EXISTS account_mapping_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  account_item_id INTEGER REFERENCES account_items(id),
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_expense_items_document ON expense_items(document_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_date ON expense_items(use_date);
CREATE INDEX IF NOT EXISTS idx_expense_items_project ON expense_items(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_account ON expense_items(account_item_id);
