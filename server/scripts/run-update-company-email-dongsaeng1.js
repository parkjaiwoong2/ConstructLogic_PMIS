require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const r = await db.pool.query("UPDATE companies SET email = 'psoonm@nate.com' WHERE name = '동생사용회사1'");
  console.log('동생사용회사1 email 변경 완료, 영향받은 행:', r.rowCount);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => process.exit(0));
