require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const isVercel = !!process.env.VERCEL;

function createPool() {
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (connStr) {
    const url = isVercel && !connStr.includes('?') ? `${connStr}?workaround=supabase-pooler.vercel` : connStr;
    return new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: isVercel ? 1 : 10,
      idleTimeoutMillis: 10000,
    });
  }
  const connectionString = `postgresql://${process.env.DB_USER || 'postgres.lhnytsihdfsgksvoahix'}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com'}:${process.env.DB_PORT || '6543'}/${process.env.DB_NAME || 'postgres'}${isVercel ? '?workaround=supabase-pooler.vercel' : ''}`;
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: isVercel ? 1 : 10,
    idleTimeoutMillis: 10000,
  });
}

const pool = createPool();

async function query(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  const r = await pool.query(sql, params);
  return { rowCount: r.rowCount, rows: r.rows };
}

module.exports = { pool, query, queryOne, run };
