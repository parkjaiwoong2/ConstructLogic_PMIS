/**
 * account_items, projects에 company_id 추가
 * master_templates_account_items, master_templates_projects 생성 (슈퍼관리자용)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  await db.pool.query('ALTER TABLE account_items ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)');
  await db.pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)');
  await db.pool.query('CREATE INDEX IF NOT EXISTS idx_account_items_company ON account_items(company_id)');
  await db.pool.query('CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id)');

  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS master_templates_account_items (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
    )
  `);
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS master_templates_projects (
      id SERIAL PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
    )
  `);
  console.log('masters company + templates migration OK');
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
