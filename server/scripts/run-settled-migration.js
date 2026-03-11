require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlPath = path.join(__dirname, 'migrate-card-settlement.pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await db.pool.query(sql);
  console.log('settled_at migration OK');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => process.exit(0));
