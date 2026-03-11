#!/usr/bin/env node
/**
 * expense_documents: company_id NULL → 언넌플랫폼 백필 후 NOT NULL 적용
 * node server/scripts/run-migrate-expense-documents-company-not-null.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlPath = path.join(__dirname, 'migrate-expense-documents-company-not-null.pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const before = await db.query('SELECT COUNT(*)::int as c FROM expense_documents WHERE company_id IS NULL');
  console.log('변경 전: company_id NULL 문서 수 =', before[0]?.c ?? 0);

  await db.pool.query(sql);
  console.log('마이그레이션 실행 완료.');

  const after = await db.query('SELECT COUNT(*)::int as c FROM expense_documents WHERE company_id IS NULL');
  console.log('변경 후: company_id NULL 문서 수 =', after[0]?.c ?? 0);
  console.log('완료.');
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
