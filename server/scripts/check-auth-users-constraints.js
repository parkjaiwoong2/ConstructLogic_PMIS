require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  const all = await db.pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'auth_users'::regclass
  `);
  console.log('auth_users 전체 제약조건:');
  all.rows.forEach(row => console.log(' ', row.conname, row.contype, '->', row.def));
  const idx = await db.pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'auth_users'");
  console.log('\nauth_users 인덱스:');
  idx.rows.forEach(row => console.log(' ', row.indexname, '\n   ', row.indexdef));
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => process.exit(0));
