/**
 * zangruri@gmail.com 슈퍼관리자 비밀번호 변경
 * 실행: node server/scripts/update-super-admin-password.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const auth = require('../auth');

const EMAIL = 'zangruri@gmail.com';
const NEW_PASSWORD = '01070502';

async function run() {
  const hash = await auth.hashPassword(NEW_PASSWORD);
  const r = await db.run(
    "UPDATE auth_users SET password_hash = $1 WHERE LOWER(TRIM(email)) = LOWER($2) RETURNING id",
    [hash, EMAIL]
  );
  const n = r?.rowCount ?? 0;
  if (n === 0) {
    console.log(`사용자를 찾을 수 없습니다: ${EMAIL}`);
    process.exit(1);
  }
  console.log(`비밀번호가 변경되었습니다: ${EMAIL} (${n}건)`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
