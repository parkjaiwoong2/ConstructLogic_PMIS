/**
 * zangruri@gmail.com만 슈퍼관리자로 유지. 나머지는 role=admin, is_admin=false로 변경
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const r = await db.run(
    `UPDATE auth_users SET role = 'admin', is_admin = false
     WHERE (role = 'superAdmin' OR is_admin = true) AND LOWER(TRIM(email)) != 'zangruri@gmail.com'
     RETURNING id, email, name, role, is_admin`
  );
  console.log('관리자로 변경됨 (슈퍼관리자 해제):', r.rows?.length || 0, '명');
  (r.rows || []).forEach(u => console.log(' -', u.email, '→ role=admin, is_admin=false'));

  const superRows = await db.query("SELECT id, email, name, role, is_admin FROM auth_users WHERE LOWER(TRIM(email)) = 'zangruri@gmail.com'");
  console.log('\n슈퍼관리자 (유지):', superRows?.[0]?.email || 'zangruri@gmail.com');
}

run().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
