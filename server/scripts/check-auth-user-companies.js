require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

(async () => {
  const exists = await db.pool.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_user_companies')"
  );
  console.log('auth_user_companies exists:', exists.rows[0]?.exists);
  const p = await db.pool.query(
    "SELECT id, email, company_id FROM auth_users WHERE email = 'psoonm@nate.com'"
  );
  console.log('psoonm auth_users:', p.rows[0]);
  const auc = await db.pool.query(
    `SELECT auc.*, c.name as company_name FROM auth_user_companies auc 
     JOIN companies c ON c.id = auc.company_id 
     WHERE auc.user_id = (SELECT id FROM auth_users WHERE email = 'psoonm@nate.com')`
  );
  console.log('psoonm auth_user_companies:', auc.rows);
})().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
