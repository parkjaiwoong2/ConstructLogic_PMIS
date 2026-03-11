#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { Pool } = require('pg');

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
  const client = await pool.connect();
  try {
    const ai = await client.query(
      'SELECT MIN(created_at) as first_created, MAX(created_at) as last_created, COUNT(*) as cnt FROM account_items WHERE company_id IS NULL'
    );
    const pj = await client.query(
      'SELECT MIN(created_at) as first_created, MAX(created_at) as last_created, COUNT(*) as cnt FROM projects WHERE company_id IS NULL'
    );
    const sample = await client.query(
      'SELECT id, company_id, code, name, created_at FROM account_items WHERE company_id IS NULL ORDER BY id LIMIT 5'
    );
    console.log('=== account_items (company_id=null) ===');
    console.log('건수:', ai.rows[0].cnt);
    console.log('최초 생성:', ai.rows[0].first_created);
    console.log('최근 생성:', ai.rows[0].last_created);
    console.log('\n=== projects (company_id=null) ===');
    console.log('건수:', pj.rows[0].cnt);
    console.log('최초 생성:', pj.rows[0].first_created);
    console.log('최근 생성:', pj.rows[0].last_created);
    console.log('\n샘플(account_items):');
    console.table(sample.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
