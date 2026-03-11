/**
 * zangruri@gmail.com, psoonm@nate.com → 관리자, 언너 플랫폼 소속
 * psoonm@nate.com → 동생사용회사1, 동생사용회사2 추가 (auth_user_companies)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const companies = await db.pool.query(
    "SELECT id, name FROM companies"
  );
  const byName = (n) => companies.rows.find((r) => (r.name || '').trim() === n)?.id;
  const byContains = (sub) => companies.rows.find((r) => (r.name || '').includes(sub))?.id;

  const 언너플랫폼Id = byName('언너 플랫폼') || byName('언너플랫폼') || byContains('언너');
  const 동생1Id = byName('동생사용회사1') || byContains('동생사용회사1');
  const 동생2Id = byName('동생사용회사2') || byName('동생 사용회사2') || byContains('동생사용회사2') || byContains('동생 사용');

  if (!언너플랫폼Id) {
    console.log('회사 목록:', companies.rows);
    throw new Error('언너 플랫폼 회사를 찾을 수 없습니다. 위 목록에서 정확한 이름을 확인하세요.');
  }

  // 1) zangruri, psoonm → 관리자 + 언너 플랫폼
  const r1 = await db.pool.query(
    `UPDATE auth_users SET is_admin = true, role = 'admin', company_id = $1, is_approved = true
     WHERE email IN ('zangruri@gmail.com', 'psoonm@nate.com')
     RETURNING id, email, name, company_id`,
    [언너플랫폼Id]
  );
  console.log('업데이트된 사용자 (관리자 + 언너 플랫폼):', r1.rows);

  // 2) auth_user_companies 테이블이 있으면 psoonm을 동생1, 동생2에 추가
  const hasTable = await db.pool.query(`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_user_companies')
  `).then(r => r.rows[0]?.exists);

  if (!hasTable) {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_user_companies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES auth_users(id),
        company_id INTEGER NOT NULL REFERENCES companies(id),
        UNIQUE(user_id, company_id)
      );
      CREATE INDEX IF NOT EXISTS idx_auth_user_companies_user ON auth_user_companies(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_user_companies_company ON auth_user_companies(company_id);
    `);
    console.log('auth_user_companies 테이블 생성 완료');
  }

  const psoonm = await db.pool.query(
    "SELECT id FROM auth_users WHERE email = 'psoonm@nate.com' LIMIT 1"
  ).then(r => r.rows[0]);
  if (psoonm && (동생1Id || 동생2Id)) {
    for (const cid of [동생1Id, 동생2Id].filter(Boolean)) {
      await db.pool.query(
        `INSERT INTO auth_user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT (user_id, company_id) DO NOTHING`,
        [psoonm.id, cid]
      );
    }
    console.log('psoonm@nate.com → 동생사용회사1, 동생사용회사2 추가 완료');
  } else if (!동생1Id && !동생2Id) {
    console.log('동생사용회사1, 동생사용회사2 회사가 없어 해당 추가는 건너뜁니다.');
  }

  console.log('처리 완료');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
