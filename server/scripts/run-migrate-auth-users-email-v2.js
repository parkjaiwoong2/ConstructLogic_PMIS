require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlPath = path.join(__dirname, 'migrate-auth-users-email-per-company-v2.pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await db.pool.query(sql);
  console.log('auth_users 이메일 회사별 유일 제약 적용 완료 (v2)');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => process.exit(0));
