/**
 * API와 동일한 로직으로 쿼리 실행 - company_id=1
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

(async () => {
  // API와 동일한 파라미터 처리
  const company_id = '1';
  const limit = 20;
  const offset = 0;

  const conditions = [];
  const params = [];
  let idx = 1;

  let companyJoin = '';
  if (company_id != null && company_id !== '') {
    params.push(parseInt(company_id, 10));
    companyJoin = `LEFT JOIN auth_user_companies auc_c ON auc_c.user_id = au.id AND auc_c.company_id = $${idx}`;
    conditions.push(`(au.company_id = $${idx} OR auc_c.user_id IS NOT NULL)`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitVal = 20;
  const offsetVal = 0;

  const sql = `
    SELECT au.id, au.email, au.name, au.role, au.is_admin, au.is_approved, au.company_id, au.project_id, au.created_at,
           p.name as project_name, COUNT(*) OVER ()::int as total
    FROM auth_users au
    LEFT JOIN projects p ON p.id = au.project_id
    ${companyJoin}
    ${where}
    ORDER BY au.is_approved ASC, au.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const fullParams = [...params, limitVal, offsetVal];
  console.log('SQL params:', fullParams);
  console.log('Placeholders: $1=%s, $2=%s, $3=%s\n', fullParams[0], fullParams[1], fullParams[2]);

  const rows = await db.query(sql, fullParams);
  console.log('Result rows:', rows.length);
  rows.forEach(r => console.log(' ', r.email, r.name, 'company_id=' + r.company_id));
})().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
