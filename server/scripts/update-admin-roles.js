/**
 * zangruri@gmail.com → 슈퍼관리자 (role=superAdmin, is_admin=true, 모든 권한 + 관리자슈퍼관리 메뉴)
 * psoonm@nate.com → 회사별 관리자 (role=admin, is_admin=false, role_menus company_admin으로 권한 관리)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const r1 = await db.pool.query(
    `UPDATE auth_users SET role = 'superAdmin', is_admin = true WHERE email = 'zangruri@gmail.com' RETURNING id, email, name, is_admin, role`
  );
  console.log('zangruri@gmail.com → 슈퍼관리자 (role=superAdmin):', r1.rows[0] || '사용자 없음');

  const r2 = await db.pool.query(
    `UPDATE auth_users SET is_admin = false WHERE email = 'psoonm@nate.com' RETURNING id, email, name, is_admin, role`
  );
  console.log('psoonm@nate.com → 회사별 관리자 (역할관리 슈퍼에서 메뉴 권한 설정):', r2.rows[0] || '사용자 없음');

  if (r2.rows.length && r2.rows[0].role !== 'admin') {
    await db.pool.query(`UPDATE auth_users SET role = 'admin' WHERE email = 'psoonm@nate.com'`);
    console.log('psoonm@nate.com role을 admin으로 설정');
  }

  console.log('처리 완료');
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
