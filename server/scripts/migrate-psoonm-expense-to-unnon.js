/**
 * psoonm@nate.com 계정으로 전체 조회 시 나오는 사용내역 데이터를 언넌플랫폼 회사로 연결
 *
 * 1) expense_documents.company_id 컬럼 추가 (user_name이 auth_users에 없을 때도 회사별 조회 가능)
 * 2) 기존 expense_documents 전건에 company_id = 언넌플랫폼 설정
 * 3) auth_users에 있는 user_name도 언넌플랫폼으로 연결
 *
 * 실행: node server/scripts/migrate-psoonm-expense-to-unnon.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const pool = db.pool;

  // 1) 언넌플랫폼 회사 찾기 (언넌, 언너 등 다양한 표기 지원)
  const companies = await pool.query('SELECT id, name FROM companies');
  const byName = (n) => companies.rows.find((r) => (r.name || '').trim() === n)?.id;
  const byContains = (sub) => companies.rows.find((r) => (r.name || '').includes(sub))?.id;

  const unnonId =
    byName('언넌플랫폼') ||
    byName('언넌 플랫폼') ||
    byName('언너플랫폼') ||
    byName('언너 플랫폼') ||
    byContains('언넌') ||
    byContains('언너');

  if (!unnonId) {
    console.log('회사 목록:', companies.rows.map((r) => `${r.id}: ${r.name}`));
    throw new Error('언넌플랫폼 회사를 찾을 수 없습니다.');
  }
  const unnonName = companies.rows.find((r) => r.id === unnonId)?.name || '언넌플랫폼';
  console.log(`언넌플랫폼 회사: id=${unnonId}, name=${unnonName}`);

  // 1) expense_documents.company_id 컬럼 추가
  await pool.query(`
    ALTER TABLE expense_documents ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_expense_documents_company ON expense_documents(company_id)
  `);
  console.log('expense_documents.company_id 컬럼 확인/생성 완료');

  // 2) 기존 expense_documents 전건을 언넌플랫폼으로 설정
  const upd = await pool.query(
    'UPDATE expense_documents SET company_id = $1 WHERE company_id IS NULL RETURNING id',
    [unnonId]
  );
  console.log(`expense_documents ${upd.rowCount}건 → company_id = ${unnonId}`);

  // 3) psoonm@nate.com 사용자
  const psoonm = await pool.query(
    "SELECT id, email, name, company_id FROM auth_users WHERE email = 'psoonm@nate.com' LIMIT 1"
  ).then((r) => r.rows[0]);

  if (!psoonm) {
    throw new Error('psoonm@nate.com 사용자를 찾을 수 없습니다.');
  }
  console.log('psoonm@nate.com:', psoonm);

  // 4) expense_documents에 있는 모든 user_name의 auth_users도 언넌플랫폼으로 연결 (추가 안전장치)
  const targetUserNames = (
    await pool.query('SELECT DISTINCT user_name FROM expense_documents WHERE user_name IS NOT NULL AND user_name != \'\'')
  ).rows.map((r) => r.user_name);

  if (targetUserNames.length === 0) {
    console.log('연결할 사용내역이 없습니다.');
    return;
  }
  console.log('대상 user_name:', targetUserNames);

  // 4) 해당 user_name의 auth_users를 언넌플랫폼으로 연결
  for (const userName of targetUserNames) {
    const au = await pool.query(
      'SELECT id, name, company_id FROM auth_users WHERE name = $1 LIMIT 1',
      [userName]
    ).then((r) => r.rows[0]);

    if (!au) {
      console.log(`  [건너뜀] auth_users에 없는 user_name: ${userName}`);
      continue;
    }

    const prevCompanyId = au.company_id;
    await pool.query(
      'UPDATE auth_users SET company_id = $1 WHERE id = $2',
      [unnonId, au.id]
    );
    console.log(`  ${userName} (id=${au.id}): company_id ${prevCompanyId} → ${unnonId}`);

    await pool.query(
      `INSERT INTO auth_user_companies (user_id, company_id) VALUES ($1, $2)
       ON CONFLICT (user_id, company_id) DO NOTHING`,
      [au.id, unnonId]
    );
  }

  // 5) psoonm 본인도 언넌플랫폼 대표회사로 설정
  await pool.query(
    'UPDATE auth_users SET company_id = $1 WHERE id = $2',
    [unnonId, psoonm.id]
  );
  await pool.query(
    `INSERT INTO auth_user_companies (user_id, company_id) VALUES ($1, $2)
     ON CONFLICT (user_id, company_id) DO NOTHING`,
    [psoonm.id, unnonId]
  );
  console.log('psoonm@nate.com → company_id = 언넌플랫폼, auth_user_companies 추가 완료');

  console.log('처리 완료.');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
