require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const isVercel = !!process.env.VERCEL;

function createPool() {
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (connStr) {
    const usePooler = connStr.includes('pooler.supabase.com');
    const sep = connStr.includes('?') ? '&' : '?';
    let params = usePooler ? 'pgbouncer=true' : '';
    if (isVercel && usePooler) params += (params ? '&' : '') + 'workaround=supabase-pooler.vercel';
    const url = params ? connStr + sep + params : connStr;
    return new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: isVercel ? 1 : 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: isVercel ? 8000 : 10000,
    });
  }
  const base = `postgresql://${process.env.DB_USER || 'postgres.lhnytsihdfsgksvoahix'}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com'}:${process.env.DB_PORT || '6543'}/${process.env.DB_NAME || 'postgres'}`;
  const connectionString = base + '?pgbouncer=true' + (isVercel ? '&workaround=supabase-pooler.vercel' : '');
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

/** bulk insert expense_items (한 번의 INSERT로 처리) */
async function insertExpenseItems(client, items, docId, projectId, projectName) {
  if (!items?.length) return;
  const vals = items.map((i, idx) => {
    const base = idx * 11;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`;
  }).join(', ');
  const params = items.flatMap(i => {
    const card = parseInt(i.card_amount || 0, 10);
    const cash = parseInt(i.cash_amount || 0, 10);
    return [docId, i.use_date, projectId, projectName || '', i.account_item_id, i.account_item_name || '', i.description || '', card, cash, card + cash, i.remark || null];
  });
  await (client || pool).query(`INSERT INTO expense_items (document_id, use_date, project_id, project_name, account_item_id, account_item_name, description, card_amount, cash_amount, total_amount, remark) VALUES ${vals}`, params);
}

/** CSV 임포트용 bulk insert (project_id=null) */
async function insertExpenseItemsCsv(client, items, docId) {
  if (!items?.length) return;
  const vals = items.map((i, idx) => {
    const base = idx * 10;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
  }).join(', ');
  const params = items.flatMap(i => [
    docId, i.use_date, null, i.project_name || '', i.account_item_id, i.account_item_name || '', i.description || '',
    i.card_amount || 0, i.cash_amount || 0, i.total_amount || 0,
  ]);
  await (client || pool).query(`INSERT INTO expense_items (document_id, use_date, project_id, project_name, account_item_id, account_item_name, description, card_amount, cash_amount, total_amount) VALUES ${vals}`, params);
}

module.exports = { pool, query, queryOne, run, insertExpenseItems, insertExpenseItemsCsv };
