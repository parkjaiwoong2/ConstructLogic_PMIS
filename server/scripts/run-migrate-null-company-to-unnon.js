#!/usr/bin/env node
/**
 * company_id=null → 언넌플랫폼으로 변경 마이그레이션 실행
 * node server/scripts/run-migrate-null-company-to-unnon.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connStr && process.env.DB_HOST) {
  connStr = `postgresql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || '6543'}/${process.env.DB_NAME || 'postgres'}`;
  if (connStr.includes('pooler.supabase.com')) connStr += (connStr.includes('?') ? '&' : '?') + 'pgbouncer=true';
}
const pool = new Pool({
  connectionString: connStr,
  ssl: connStr && connStr.includes('pooler') ? { rejectUnauthorized: false } : undefined
});

async function main() {
  const sqlPath = path.join(__dirname, 'migrate-null-company-to-unnon.pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s && /UPDATE\s/i.test(s));

  const client = await pool.connect();
  try {
    const beforeAi = await client.query('SELECT COUNT(*) as c FROM account_items WHERE company_id IS NULL');
    const beforePj = await client.query('SELECT COUNT(*) as c FROM projects WHERE company_id IS NULL');
    console.log('변경 전: account_items null=', beforeAi.rows[0].c, ', projects null=', beforePj.rows[0].c);

    for (const stmt of statements) {
      if (stmt) {
        await client.query(stmt);
        console.log('실행:', stmt.slice(0, 60) + '...');
      }
    }

    const afterAi = await client.query('SELECT COUNT(*) as c FROM account_items WHERE company_id IS NULL');
    const afterPj = await client.query('SELECT COUNT(*) as c FROM projects WHERE company_id IS NULL');
    console.log('변경 후: account_items null=', afterAi.rows[0].c, ', projects null=', afterPj.rows[0].c);
    console.log('완료.');
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
