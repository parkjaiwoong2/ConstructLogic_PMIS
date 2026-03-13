/**
 * psoonm@nate.com → 회사관리자로 고정 (is_admin=false)
 * 관리자관리 메뉴는 슈퍼관리자(is_admin=true)만 볼 수 있으므로,
 * 이 스크립트 실행 후 psoonm은 관리자관리 메뉴가 보이지 않습니다.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const r = await db.pool.query(
    `UPDATE auth_users SET is_admin = false WHERE LOWER(TRIM(email)) = 'psoonm@nate.com' RETURNING id, email, name, is_admin, role`
  );
  console.log('psoonm@nate.com is_admin=false 적용:', r.rows.length, '건', r.rows);
  if (r.rows.length === 0) console.log('해당 사용자가 없습니다.');
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
