/**
 * 사용자(psoonm@nate.com)의 회사 소속 확인
 * node server/scripts/check-user-companies.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const email = 'psoonm@nate.com';
  const user = await db.pool.query(
    'SELECT id, email, is_admin, company_id FROM auth_users WHERE email = $1',
    [email]
  ).then(r => r.rows[0]);
  if (!user) {
    console.log('사용자를 찾을 수 없습니다:', email);
    process.exit(0);
    return;
  }
  console.log('사용자:', user);

  const auc = await db.pool.query(
    'SELECT auc.company_id, c.name FROM auth_user_companies auc JOIN companies c ON c.id = auc.company_id WHERE auc.user_id = $1',
    [user.id]
  ).then(r => r.rows);
  console.log('auth_user_companies 소속:', auc);

  const mainCompany = user.company_id
    ? await db.pool.query('SELECT id, name FROM companies WHERE id = $1', [user.company_id]).then(r => r.rows[0])
    : null;
  console.log('auth_users.company_id (메인회사):', mainCompany);

  const allCompanies = await db.pool.query(`
    SELECT c.id, c.name FROM companies c
    WHERE c.id IN (
      SELECT company_id FROM auth_user_companies WHERE user_id = $1
      UNION
      SELECT company_id FROM auth_users WHERE id = $1 AND company_id IS NOT NULL
    )
  `, [user.id]);
  console.log('getCompaniesForUser 결과 (콤보에 나올 회사):', allCompanies.rows);

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
