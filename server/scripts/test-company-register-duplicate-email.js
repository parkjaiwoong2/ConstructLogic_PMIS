/**
 * 동일 이메일로 새 회사 등록 테스트
 * (실제 등록은 하지 않고 auth_users INSERT만 시뮬레이션)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const testEmail = 'psoonm@nate.com';
  const testCompanyName = '테스트회사_' + Date.now();
  console.log('1. 기존 사용자 확인:', testEmail);
  const existing = await db.pool.query(
    'SELECT id, company_id, email FROM auth_users WHERE LOWER(TRIM(email)) = $1',
    [testEmail.toLowerCase()]
  );
  console.log('   기존 행:', existing.rows);

  console.log('\n2. 새 회사 생성');
  const cr = await db.pool.query(
    `INSERT INTO companies (name, is_default) VALUES ($1, false) RETURNING id`,
    [testCompanyName]
  );
  const newId = cr.rows[0].id;
  console.log('   새 회사 id:', newId);

  console.log('\n3. 동일 이메일로 auth_users INSERT 시도 (다른 회사)');
  try {
    await db.pool.query(
      `INSERT INTO auth_users (company_id, email, password_hash, name, role, is_admin, is_approved)
       VALUES ($1, $2, 'hash', '테스트', 'admin', false, true)`,
      [newId, testEmail]
    );
    console.log('   성공!');
  } catch (e) {
    console.log('   실패:', e.code, e.constraint, e.message);
  }

  await db.pool.query('DELETE FROM auth_users WHERE company_id = $1', [newId]);
  await db.pool.query('DELETE FROM companies WHERE id = $1', [newId]);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => process.exit(0));
