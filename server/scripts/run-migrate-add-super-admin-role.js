/**
 * 실행: node server/scripts/run-migrate-add-super-admin-role.js
 * 기존 is_admin=true 사용자를 role='superAdmin'으로 설정합니다.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlPath = path.join(__dirname, 'migrate-add-super-admin-role.pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const r = await db.pool.query(sql);
  console.log('superAdmin 역할 마이그레이션 완료. 변경 건수:', r.rowCount ?? 0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => process.exit(0));
