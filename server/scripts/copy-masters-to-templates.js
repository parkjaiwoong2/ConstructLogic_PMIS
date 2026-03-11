/**
 * account_items, projects 데이터를 master_templates_account_items, master_templates_projects로 복사
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const accounts = await db.pool.query('SELECT code, name, display_order FROM account_items ORDER BY display_order, id');
  const projects = await db.pool.query('SELECT code, name FROM projects ORDER BY id');

  let insertedAccounts = 0;
  for (const a of accounts.rows) {
    const code = a.code || `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const exists = await db.pool.query(
      'SELECT 1 FROM master_templates_account_items WHERE code = $1 AND name = $2 LIMIT 1',
      [code, a.name]
    );
    if (!exists.rows.length) {
      await db.pool.query(
        'INSERT INTO master_templates_account_items (code, name, display_order) VALUES ($1, $2, $3)',
        [code, a.name, a.display_order ?? 0]
      );
      insertedAccounts++;
    }
  }
  console.log(`account_items ${accounts.rows.length}건 중 ${insertedAccounts}건 → master_templates_account_items 복사 완료`);

  let insertedProjects = 0;
  for (const p of projects.rows) {
    const exists = await db.pool.query(
      'SELECT 1 FROM master_templates_projects WHERE (code IS NOT DISTINCT FROM $1) AND name = $2 LIMIT 1',
      [p.code || null, p.name]
    );
    if (!exists.rows.length) {
      await db.pool.query(
        'INSERT INTO master_templates_projects (code, name) VALUES ($1, $2)',
        [p.code || null, p.name]
      );
      insertedProjects++;
    }
  }
  console.log(`projects ${projects.rows.length}건 중 ${insertedProjects}건 → master_templates_projects 복사 완료`);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
