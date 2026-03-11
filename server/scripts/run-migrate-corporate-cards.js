require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function run() {
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS corporate_cards (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      card_no TEXT NOT NULL,
      label TEXT,
      created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul'),
      UNIQUE(company_id, card_no)
    );
  `);
  await db.pool.query(`
    CREATE INDEX IF NOT EXISTS idx_corporate_cards_company ON corporate_cards(company_id);
  `);
  console.log('corporate_cards migration OK');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
