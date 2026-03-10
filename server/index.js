require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== API 라우트 ==========

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/account-items', async (req, res) => {
  try {
    const rows = await db.query('SELECT id, code, name, display_order FROM account_items ORDER BY display_order');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const rows = await db.query('SELECT DISTINCT user_name FROM expense_documents WHERE user_name IS NOT NULL AND user_name != \'\' ORDER BY user_name');
    res.json(rows.map(r => r.user_name));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const rows = await db.query('SELECT id, code, name FROM projects ORDER BY name');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/suggest-account', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json(null);
  try {
    const rules = await db.queryOne(`
      SELECT amr.keyword, ai.id, ai.name
      FROM account_mapping_rules amr
      JOIN account_items ai ON ai.id = amr.account_item_id
      WHERE $1 LIKE '%' || amr.keyword || '%'
      ORDER BY amr.priority DESC
      LIMIT 1
    `, [q]);
    res.json(rules ? { id: rules.id, name: rules.name } : null);
  } catch (e) {
    res.json(null);
  }
});

app.get('/api/documents', async (req, res) => {
  const { status, project, user_name, limit, offset } = req.query;
  try {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (project) { params.push(project); where.push(`project_name = $${params.length}`); }
    if (user_name) { params.push(user_name); where.push(`user_name = $${params.length}`); }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const baseSql = `SELECT id, doc_no, user_name, project_name, period_start, period_end,
      status, total_card_amount, total_cash_amount, created_at
      FROM expense_documents${whereClause}`;
    let rowParams = [...params];
    let pageSql = baseSql + ' ORDER BY created_at DESC';
    if (limit != null) { rowParams.push(parseInt(limit, 10)); pageSql += ` LIMIT $${rowParams.length}`; }
    if (offset != null) { rowParams.push(parseInt(offset, 10)); pageSql += ` OFFSET $${rowParams.length}`; }
    const [countRes, rowsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int as total FROM expense_documents${whereClause}`, params),
      db.query(pageSql, rowParams),
    ]);
    const total = countRes[0]?.total ?? 0;
    const rows = rowsRes;
    if (limit != null || offset != null) {
      res.json({ items: rows, total });
    } else {
      res.json(rows);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await db.queryOne('SELECT * FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const items = await db.query(`
      SELECT ei.*, ai.name as account_item_name
      FROM expense_items ei
      LEFT JOIN account_items ai ON ai.id = ei.account_item_id
      WHERE ei.document_id = $1 ORDER BY ei.use_date, ei.id
    `, [req.params.id]);
    res.json({ ...doc, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents', async (req, res) => {
  const { user_name, project_id, project_name, period_start, period_end, card_no, items } = req.body;
  if (!user_name || !project_name || !period_start || !period_end || !items?.length) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }
  try {
    const docNo = `CARD-${Date.now()}`;
    let totalCard = 0, totalCash = 0;
    items.forEach(i => {
      totalCard += parseInt(i.card_amount || 0, 10);
      totalCash += parseInt(i.cash_amount || 0, 10);
    });
    const r = await db.run(`
      INSERT INTO expense_documents (doc_no, user_name, project_id, project_name, period_start, period_end, card_no, status, total_card_amount, total_cash_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9) RETURNING id
    `, [docNo, user_name, project_id || null, project_name, period_start, period_end, card_no || null, totalCard, totalCash]);
    const docId = r.rows[0].id;
    for (const i of items) {
      const cardAmt = parseInt(i.card_amount || 0, 10);
      const cashAmt = parseInt(i.cash_amount || 0, 10);
      await db.run(`
        INSERT INTO expense_items (document_id, use_date, project_id, project_name, account_item_id, account_item_name, description, card_amount, cash_amount, total_amount, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [docId, i.use_date, project_id || null, project_name, i.account_item_id, i.account_item_name, i.description, cardAmt, cashAmt, cardAmt + cashAmt, i.remark || null]);
    }
    res.json({ id: docId, doc_no: docNo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  const { user_name, project_id, project_name, period_start, period_end, card_no, items } = req.body;
  const id = parseInt(req.params.id, 10);
  if (!id || !items?.length) return res.status(400).json({ error: '필수 항목 누락' });
  try {
    const doc = await db.queryOne('SELECT status FROM expense_documents WHERE id = $1', [id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'draft') return res.status(400).json({ error: '작성중 상태에서만 수정 가능합니다.' });
    let totalCard = 0, totalCash = 0;
    items.forEach(i => {
      totalCard += parseInt(i.card_amount || 0, 10);
      totalCash += parseInt(i.cash_amount || 0, 10);
    });
    await db.run(`
      UPDATE expense_documents SET user_name=$1, project_id=$2, project_name=$3, period_start=$4, period_end=$5, card_no=$6,
        total_card_amount=$7, total_cash_amount=$8, updated_at=now()
      WHERE id=$9
    `, [user_name || '', project_id, project_name || '', period_start || '', period_end || '', card_no || null, totalCard, totalCash, id]);
    await db.run('DELETE FROM expense_items WHERE document_id = $1', [id]);
    for (const i of items) {
      const cardAmt = parseInt(i.card_amount || 0, 10);
      const cashAmt = parseInt(i.cash_amount || 0, 10);
      await db.run(`
        INSERT INTO expense_items (document_id, use_date, project_id, project_name, account_item_id, account_item_name, description, card_amount, cash_amount, total_amount, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [id, i.use_date, project_id || null, project_name, i.account_item_id, i.account_item_name, i.description, cardAmt, cashAmt, cardAmt + cashAmt, i.remark || null]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents/:id/submit', async (req, res) => {
  try {
    const r = await db.run("UPDATE expense_documents SET status='pending', updated_at=now() WHERE id=$1 AND status='draft' RETURNING id", [req.params.id]);
    if (!r.rows?.length) return res.status(400).json({ error: '작성중 문서만 결재 요청할 수 있습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents/:id/withdraw', async (req, res) => {
  try {
    const r = await db.run("UPDATE expense_documents SET status='draft', updated_at=now() WHERE id=$1 AND status='pending' RETURNING id", [req.params.id]);
    if (!r.rows?.length) return res.status(400).json({ error: '결재대기 상태에서만 기안 취소할 수 있습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents/:id/approve', async (req, res) => {
  const { action, approver_name, comment } = req.body;
  if (!['approved', 'rejected'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    await db.run('UPDATE expense_documents SET status=$1, updated_at=now() WHERE id=$2', [action === 'approved' ? 'approved' : 'rejected', req.params.id]);
    await db.run('INSERT INTO approval_history (document_id, approver_name, action, comment) VALUES ($1, $2, $3, $4)', [req.params.id, approver_name || '결재자', action, comment || null]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/expenses', async (req, res) => {
  const { from, to, project, account_item_id, account_item_name, user_name, description, limit, offset } = req.query;
  try {
    const cond = [];
    const params = [];
    if (from) { params.push(from); cond.push(`ei.use_date >= $${params.length}`); }
    if (to) { params.push(to); cond.push(`ei.use_date <= $${params.length}`); }
    if (project) { params.push(project); cond.push(`ei.project_name = $${params.length}`); }
    if (account_item_id) { params.push(account_item_id); cond.push(`ei.account_item_id = $${params.length}`); }
    else if (account_item_name) { params.push(account_item_name); cond.push(`ei.account_item_name = $${params.length}`); }
    if (user_name) { params.push(`%${user_name}%`); cond.push(`ed.user_name LIKE $${params.length}`); }
    if (description) { params.push(`%${description}%`); cond.push(`ei.description LIKE $${params.length}`); }
    const whereClause = "ed.status IN ('approved','pending')" + (cond.length ? ' AND ' + cond.join(' AND ') : '');
    const baseSql = `SELECT ei.id, ei.document_id, ei.use_date, ei.project_name, ei.account_item_id, ei.account_item_name, ei.description, ei.card_amount, ei.cash_amount, ei.total_amount, ed.status, ed.user_name
      FROM expense_items ei
      LEFT JOIN expense_documents ed ON ed.id = ei.document_id
      WHERE ${whereClause}`;
    let rowParams = [...params];
    let pageSql = baseSql + ' ORDER BY ei.use_date DESC, ei.id';
    if (limit != null) { rowParams.push(parseInt(limit, 10)); pageSql += ` LIMIT $${rowParams.length}`; }
    if (offset != null) { rowParams.push(parseInt(offset, 10)); pageSql += ` OFFSET $${rowParams.length}`; }
    const countSql = `SELECT COUNT(*)::int as total FROM expense_items ei LEFT JOIN expense_documents ed ON ed.id = ei.document_id WHERE ${whereClause}`;
    const [countRes, rowsRes] = await Promise.all([
      db.query(countSql, params),
      db.query(pageSql, rowParams),
    ]);
    const total = countRes[0]?.total ?? 0;
    const rows = rowsRes;
    if (limit != null || offset != null) {
      res.json({ items: rows, total });
    } else {
      res.json(rows);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/summary', async (req, res) => {
  const { from, to, project } = req.query;
  try {
    let where = "ed.status IN ('approved','pending')";
    const params = [];
    if (from) { params.push(from); where += ` AND ei.use_date >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND ei.use_date <= $${params.length}`; }
    if (project) { params.push(project); where += ` AND ei.project_name = $${params.length}`; }
    const [byAccount, byProject, byMonth] = await Promise.all([
      db.query(`SELECT ei.account_item_id, ei.account_item_name, SUM(ei.total_amount)::bigint as total
        FROM expense_items ei JOIN expense_documents ed ON ed.id = ei.document_id
        WHERE ${where} GROUP BY ei.account_item_id, ei.account_item_name ORDER BY total DESC`, params),
      db.query(`SELECT ei.project_name, SUM(ei.total_amount)::bigint as total
        FROM expense_items ei JOIN expense_documents ed ON ed.id = ei.document_id
        WHERE ${where} GROUP BY ei.project_name ORDER BY total DESC`, params),
      db.query(`SELECT to_char(ei.use_date::date, 'YYYY-MM') as month, SUM(ei.total_amount)::bigint as total
        FROM expense_items ei JOIN expense_documents ed ON ed.id = ei.document_id
        WHERE ${where} GROUP BY to_char(ei.use_date::date, 'YYYY-MM') ORDER BY month`, params),
    ]);
    res.json({ byAccount, byProject, byMonth });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import/csv', async (req, res) => {
  const { rows, user_name, card_no } = req.body;
  if (!rows?.length) return res.status(400).json({ error: 'No data' });
  try {
    const safeInt = (v) => {
      if (v == null || v === '') return 0;
      const s = String(v).replace(/,/g, '').replace(/\s/g, '').trim();
      if (!s || /^-$/.test(s)) return 0;
      const n = parseInt(s, 10);
      return Number.isNaN(n) ? 0 : n;
    };
    const safeId = (v) => {
      if (v == null) return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const accountItems = await db.query('SELECT id, name FROM account_items');
    const nameToId = {};
    accountItems.forEach(a => { nameToId[(a.name || '').trim()] = a.id; });
    const items = rows.map(r => {
      const card = safeInt(r.card_amount);
      const cash = safeInt(r.cash_amount);
      const aid = nameToId[(r.account_item_name || '').trim()];
      return {
        use_date: (r.use_date || '').trim(),
        project_name: (r.project_name || '').trim(),
        account_item_name: (r.account_item_name || '').trim(),
        account_item_id: (aid != null && !Number.isNaN(aid)) ? aid : null,
        description: (r.description || '').trim(),
        card_amount: card,
        cash_amount: cash,
      };
    }).filter(i => i.use_date && i.account_item_name && (i.card_amount || i.cash_amount));
    if (items.length === 0) return res.status(400).json({ error: '유효한 데이터 없음' });
    const project_name = items[0].project_name || '미지정';
    const dates = items.map(i => i.use_date).sort();
    const totalCard = items.reduce((s, i) => s + i.card_amount, 0);
    const totalCash = items.reduce((s, i) => s + i.cash_amount, 0);
    const docNo = `CARD-IMPORT-${Date.now()}`;
    const r = await db.run(`
      INSERT INTO expense_documents (doc_no, user_name, project_name, period_start, period_end, card_no, status, total_card_amount, total_cash_amount)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8) RETURNING id
    `, [docNo, user_name || 'import', project_name, dates[0], dates[dates.length - 1], card_no || null, totalCard, totalCash]);
    const docId = r.rows[0].id;
    for (const i of items) {
      const card = safeInt(i.card_amount);
      const cash = safeInt(i.cash_amount);
      const total = safeInt(card + cash);
      const aid = safeId(i.account_item_id);
      await db.run(`
        INSERT INTO expense_items (document_id, use_date, project_name, account_item_id, account_item_name, description, card_amount, cash_amount, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [docId, i.use_date, i.project_name, aid, i.account_item_name, i.description, card, cash, total]);
    }
    res.json({ id: docId, doc_no: docNo, count: items.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { code, name } = req.body;
  if (!name) return res.status(400).json({ error: '현장명 필수' });
  try {
    const r = await db.run('INSERT INTO projects (code, name) VALUES ($1, $2) RETURNING id', [code || null, name]);
    res.json({ id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/account-items', async (req, res) => {
  const { code, name } = req.body;
  if (!name) return res.status(400).json({ error: '항목명 필수' });
  try {
    const r = await db.run('INSERT INTO account_items (code, name) VALUES ($1, $2) RETURNING id', [code || `ITEM-${Date.now()}`, name]);
    res.json({ id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA: API가 아닌 경로는 index.html 서빙 (단일 배포용)
const publicDir = require('path').join(__dirname, '..', 'public');
const pathMod = require('path');
if (require('fs').existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`API server http://localhost:${PORT}`));
}
module.exports = app;
