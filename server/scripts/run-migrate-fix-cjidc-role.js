/**
 * 역할 코드 한글 -> 영문 수정: 관리자->admin, 작성자->author
 * 대상: 케이제이아이디씨(주), 케이제이종합건설(주)
 * 실행: node server/scripts/run-migrate-fix-cjidc-role.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

const COMPANIES = ['케이제이아이디씨(주)', '케이제이종합건설(주)'];
const FIXES = [
  { from: '관리자', to: 'admin' },
  { from: '작성자', to: 'author' },
];

async function fixCompany(cid, companyName) {
  for (const { from, to } of FIXES) {
    await db.run('UPDATE role_menus SET role = $1 WHERE company_id = $2 AND role = $3', [to, cid, from]);
    await db.run('UPDATE auth_users SET role = $1 WHERE company_id = $2 AND role = $3', [to, cid, from]);
    const auc = await db.query('SELECT user_id FROM auth_user_companies WHERE company_id = $1', [cid]);
    for (const row of auc || []) {
      await db.run('UPDATE auth_users SET role = $1 WHERE id = $2 AND role = $3', [to, row.user_id, from]);
    }
    await db.run('UPDATE approval_sequences SET role = $1 WHERE company_id = $2 AND role = $3', [to, cid, from]);
    await db.run('UPDATE roles SET code = $1 WHERE company_id = $2 AND code = $3', [to, cid, from]);
  }
  console.log(`${companyName}: 관리자->admin, 작성자->author 수정 완료`);
}

async function run() {
  for (const name of COMPANIES) {
    const c = await db.queryOne('SELECT id FROM companies WHERE TRIM(name) = $1 LIMIT 1', [name]);
    if (c) await fixCompany(c.id, name);
    else console.log(`회사 "${name}" 를 찾을 수 없습니다.`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
