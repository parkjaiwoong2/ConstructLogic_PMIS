require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

(async () => {
  // 1. companies 목록 - 동생사용회사1의 id 확인
  const companies = await db.query('SELECT id, name, is_default FROM companies ORDER BY is_default DESC, id');
  console.log('=== companies ===');
  companies.forEach(c => console.log(`  id=${c.id}, name=${c.name}`));

  // 2. 동생사용회사1(id=1)로 사용자 조회 - batch/users-page와 동일한 쿼리
  const companyId = 1;
  const conditions = ['(au.company_id = $1 OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $1))'];
  const params = [companyId, 20, 0];
  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await db.query(`
    SELECT au.id, au.email, au.name, au.role, au.company_id,
           (SELECT name FROM companies WHERE id = au.company_id) as main_company_name
    FROM auth_users au
    ${where}
    ORDER BY au.email
    LIMIT $2 OFFSET $3
  `, params);

  console.log('\n=== company_id=1 (동생사용회사1) 필터 적용 시 조회 결과 ===');
  console.log('총', rows.length, '명');
  rows.forEach(r => console.log(`  ${r.email} (${r.name}), auth_users.company_id=${r.company_id}, main=${r.main_company_name}`));

  // 3. psoonm만 별도 확인
  const psoonm = rows.find(r => r.email === 'psoonm@nate.com');
  console.log('\n=== psoonm 포함 여부 ===', psoonm ? 'O' : 'X');
})().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
