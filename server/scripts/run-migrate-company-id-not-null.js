#!/usr/bin/env node
/**
 * company_id NULL → 기본 회사로 백필 후 NOT NULL 적용
 * node server/scripts/run-migrate-company-id-not-null.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlPath = path.join(__dirname, 'migrate-company-id-not-null.pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const tables = ['auth_users', 'approval_sequences', 'role_menus', 'account_items', 'projects', 'expense_documents', 'user_cards', 'roles'];
  const before = {};
  for (const t of tables) {
    try {
      const r = await db.query(`SELECT COUNT(*)::int as c FROM ${t} WHERE company_id IS NULL`);
      before[t] = r[0]?.c ?? 0;
    } catch (e) { before[t] = 'N/A'; }
  }
  console.log('변경 전 NULL 건수:', before);

  await db.pool.query(sql);
  console.log('마이그레이션 실행 완료.');

  const after = {};
  for (const t of tables) {
    try {
      const r = await db.query(`SELECT COUNT(*)::int as c FROM ${t} WHERE company_id IS NULL`);
      after[t] = r[0]?.c ?? 0;
    } catch (e) { after[t] = 'N/A'; }
  }
  console.log('변경 후 NULL 건수:', after);
  console.log('완료.');
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
