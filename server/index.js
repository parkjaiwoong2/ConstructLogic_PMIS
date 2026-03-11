require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const parseAuth = (req, res, next) => {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    const token = h.slice(7);
    req.user = auth.verifyToken(token);
  }
  next();
};
app.use(parseAuth);

// ========== 인증/회사 API (로그인 전 접근) ==========

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
  try {
    const user = await db.queryOne('SELECT id, email, password_hash, name, role, is_admin, is_approved, company_id, project_id FROM auth_users WHERE email = $1', [email.trim()]);
    if (!user || !(await auth.verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    if (!user.is_admin && !user.is_approved) {
      return res.status(403).json({ error: '가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.' });
    }
    const token = auth.signToken(user);
    const { password_hash, ...u } = user;
    res.json({ token, user: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name, project_id } = req.body;
  if (!email?.trim() || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
  if (password.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
  if (!project_id) return res.status(400).json({ error: '현장을 선택하세요.' });
  try {
    let companyId = (await db.queryOne('SELECT id FROM companies WHERE is_default = true'))?.id;
    if (!companyId) companyId = (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    const hash = await auth.hashPassword(password);
    const r = await db.run(
      `INSERT INTO auth_users (company_id, project_id, email, password_hash, name, role, is_approved)
       VALUES ($1, $2, $3, $4, $5, 'author', false) RETURNING id, email, name`,
      [companyId, parseInt(project_id, 10) || null, email.trim(), hash, (name || '').trim() || email.split('@')[0]]
    );
    res.json({ message: '가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.', user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    if (e.code === '23503') return res.status(400).json({ error: '유효한 현장을 선택하세요.' });
    res.status(500).json({ error: e.message });
  }
});

const COMPANY_DEFAULTS = { name: 'Construct Logic', logo_url: null, address: null, ceo_name: null, founded_date: null, business_reg_no: null, tel: null, fax: null, email: null, copyright_text: null };

app.get('/api/companies', async (req, res) => {
  try {
    let row = await db.queryOne('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text FROM companies WHERE is_default = true');
    if (!row) row = await db.queryOne('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text FROM companies ORDER BY id LIMIT 1');
    res.json(row ? { ...COMPANY_DEFAULTS, ...row } : COMPANY_DEFAULTS);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [user, companyRow] = await Promise.all([
      db.queryOne('SELECT id, email, name, role, is_admin, company_id FROM auth_users WHERE id = $1', [req.user.id]),
      (async () => {
        let r = await db.queryOne('SELECT id, name, logo_url FROM companies WHERE is_default = true');
        return r || db.queryOne('SELECT id, name, logo_url FROM companies ORDER BY id LIMIT 1');
      })()
    ]);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const hasFullAccess = user.is_admin || user.role === 'admin';
    const menus = hasFullAccess
      ? ['/', '/expense/new', '/expenses', '/import', '/documents', '/approval', '/card-settlement', '/masters', '/settings', '/admin/company', '/admin/users', '/admin/role-permissions', '/admin/approval-sequence']
      : (await db.query('SELECT menu_path FROM role_menus WHERE role = $1', [user.role])).map(r => r.menu_path);
    const company = companyRow ? { ...COMPANY_DEFAULTS, ...companyRow } : COMPANY_DEFAULTS;
    res.json({ user, menus: [...new Set(menus)], company });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

app.get('/api/card-settlement', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { period_from, period_to, project, card_no, settled, limit, offset } = req.query;
  try {
    const where = ['status = \'approved\''];
    const params = [];
    if (project) { params.push(project); where.push(`project_name = $${params.length}`); }
    if (card_no != null && String(card_no).trim() !== '') {
      params.push(`%${String(card_no).trim()}%`);
      where.push(`(card_no ILIKE $${params.length})`);
    }
    if (period_from) { params.push(period_from); where.push(`period_end >= $${params.length}`); }
    if (period_to) { params.push(period_to); where.push(`period_start <= $${params.length}`); }
    if (settled === 'y' || settled === '1' || settled === 'true') where.push('settled_at IS NOT NULL');
    else if (settled === 'n' || settled === '0' || settled === 'false') where.push('settled_at IS NULL');
    const whereClause = ' WHERE ' + where.join(' AND ');
    const limitVal = limit != null ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    const offsetVal = offset != null ? Math.max(0, parseInt(offset, 10)) : 0;
    const [countRes, rowsRes, sumRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int as total FROM expense_documents${whereClause}`, params),
      db.query(`SELECT id, doc_no, user_name, project_name, period_start, period_end, card_no, total_card_amount, total_cash_amount, settled_at
        FROM expense_documents${whereClause}
        ORDER BY period_start DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limitVal, offsetVal]),
      db.query(`SELECT COALESCE(SUM(total_card_amount), 0)::bigint as sum_card, COALESCE(SUM(total_cash_amount), 0)::bigint as sum_cash FROM expense_documents${whereClause}`, params),
    ]);
    const sumRow = sumRes[0];
    res.json({
      items: rowsRes,
      total: countRes[0]?.total ?? 0,
      sum_card_amount: sumRow ? Number(sumRow.sum_card) : 0,
      sum_cash_amount: sumRow ? Number(sumRow.sum_cash) : 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/card-settlement/process', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { document_ids } = req.body;
  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return res.status(400).json({ error: '정산할 문서를 선택하세요.' });
  }
  const ids = document_ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
  if (ids.length === 0) return res.status(400).json({ error: '유효한 문서 ID가 없습니다.' });
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await db.run(
      `UPDATE expense_documents SET settled_at = (now() AT TIME ZONE 'Asia/Seoul') WHERE id IN (${placeholders}) AND status = 'approved'`,
      ids
    );
    res.json({ ok: true, count: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/documents', async (req, res) => {
  const { status, project, user_name, card_no, period_from, period_to, limit, offset } = req.query;
  try {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (project) { params.push(project); where.push(`project_name = $${params.length}`); }
    if (user_name) { params.push(user_name); where.push(`user_name = $${params.length}`); }
    if (card_no != null && String(card_no).trim() !== '') {
      params.push(`%${String(card_no).trim()}%`);
      where.push(`(card_no ILIKE $${params.length})`);
    }
    if (period_from) { params.push(period_from); where.push(`period_end >= $${params.length}`); }
    if (period_to) { params.push(period_to); where.push(`period_start <= $${params.length}`); }
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

const roleLabelMap = { reviewer: '검토', approver: '승인', ceo: '승인' };

app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await db.queryOne('SELECT * FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const [items, history] = await Promise.all([
      db.query(`
        SELECT ei.*, ai.name as account_item_name
        FROM expense_items ei
        LEFT JOIN account_items ai ON ai.id = ei.account_item_id
        WHERE ei.document_id = $1 ORDER BY ei.use_date, ei.id
      `, [req.params.id]),
      db.query('SELECT approver_name, sequence, action, comment FROM approval_history WHERE document_id = $1 ORDER BY sequence ASC, id ASC', [req.params.id]),
    ]);
    let companyId = null;
    try {
      const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [doc.user_name]);
      companyId = cu?.company_id;
    } catch (_) {}
    if (!companyId) {
      const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
      companyId = def?.id;
    }
    if (!companyId) {
      const first = await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1');
      companyId = first?.id;
    }
    let sequences = [];
    if (companyId) {
      sequences = await db.query('SELECT role FROM approval_sequences WHERE company_id = $1 ORDER BY sort_order ASC', [companyId]);
    }
    const steps = history.map((h, idx) => {
      const roleLabel = sequences[idx] ? (roleLabelMap[sequences[idx].role] || sequences[idx].role) : (idx === 0 ? '검토' : '승인');
      return { label: roleLabel, name: h.approver_name, action: h.action, comment: h.comment };
    });
    res.json({ ...doc, items, approval_steps: steps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents', async (req, res) => {
  const { user_name, project_id, project_name, period_start, period_end, card_no, items } = req.body;
  if (!user_name || !project_name || !period_start || !period_end || !items?.length) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }
  if (!card_no || !String(card_no).trim()) {
    return res.status(400).json({ error: '카드번호를 입력해 주세요.' });
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
    await db.insertExpenseItems(null, items, docId, project_id || null, project_name);
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
    let isAdminEdit = false;
    if (doc.status !== 'draft') {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const u = await db.queryOne('SELECT id, name, is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
      if (!u || (u.is_admin !== true && u.role !== 'admin')) {
        return res.status(403).json({ error: '작성중 상태에서만 수정 가능합니다. 관리자만 결재대기·승인·반려 문서를 수정할 수 있습니다.' });
      }
      isAdminEdit = true;
    }
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
    await db.insertExpenseItems(null, items, id, project_id || null, project_name);
    if (isAdminEdit && req.user?.id) {
      const u = await db.queryOne('SELECT id, name FROM auth_users WHERE id = $1', [req.user.id]);
      await db.run(
        'INSERT INTO admin_edit_history (document_id, admin_user_id, admin_name, document_status) VALUES ($1, $2, $3, $4)',
        [id, u?.id, u?.name || '관리자', doc.status]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents/:id/submit', async (req, res) => {
  try {
    const doc = await db.queryOne('SELECT id, status, card_no, user_name FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'draft') return res.status(400).json({ error: '작성중 문서만 결재 요청할 수 있습니다.' });
    if (!doc.card_no || !String(doc.card_no).trim()) return res.status(400).json({ error: '카드번호가 없습니다. 문서를 수정해 카드번호를 입력한 후 기안해 주세요.' });
    let companyId = null;
    const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [doc.user_name]);
    if (cu?.company_id) companyId = cu.company_id;
    if (!companyId) {
      const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
      companyId = def?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    const settings = companyId ? await db.queryOne('SELECT auto_approve FROM company_settings WHERE company_id = $1', [companyId]) : null;
    const autoApprove = settings?.auto_approve === true;
    const newStatus = autoApprove ? 'approved' : 'pending';
    const r = await db.run(`UPDATE expense_documents SET status=$1, updated_at=now() WHERE id=$2 AND status='draft' RETURNING id`, [newStatus, req.params.id]);
    if (!r.rows?.length) return res.status(400).json({ error: '작성중 문서만 결재 요청할 수 있습니다.' });
    if (autoApprove) {
      await db.run('INSERT INTO approval_history (document_id, approver_name, action, comment) VALUES ($1, $2, $3, $4)', [req.params.id, '자동승인', 'approved', '자동승인']);
    }
    res.json({ ok: true, auto_approve: autoApprove });
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

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const doc = await db.queryOne('SELECT status FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'draft') return res.status(400).json({ error: '작성중(기안 전) 문서만 삭제할 수 있습니다.' });
    await db.run('DELETE FROM expense_items WHERE document_id = $1', [req.params.id]);
    await db.run('DELETE FROM expense_documents WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents/:id/approve', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { action, comment } = req.body;
  if (!['approved', 'rejected'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    const u = await db.queryOne('SELECT name FROM auth_users WHERE id = $1', [req.user.id]);
    const approverName = u?.name || '결재자';
    const cnt = await db.queryOne('SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM approval_history WHERE document_id = $1', [req.params.id]);
    await db.run('UPDATE expense_documents SET status=$1, updated_at=now() WHERE id=$2', [action === 'approved' ? 'approved' : 'rejected', req.params.id]);
    await db.run('INSERT INTO approval_history (document_id, approver_name, sequence, action, comment) VALUES ($1, $2, $3, $4, $5)', [req.params.id, approverName, cnt?.next_seq || 1, action, comment || null]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/expenses', async (req, res) => {
  const { from, to, project, account_item_id, account_item_name, user_name, description, limit, offset } = req.query;
  const parsed = require('url').parse(req.url || '', true);
  const status = (parsed.query && parsed.query.status) || req.query.status;
  try {
    const cond = [];
    const params = [];
    const validStatuses = ['draft', 'pending', 'approved', 'rejected'];
    const statusVal = typeof status === 'string' ? status.trim() : '';
    if (statusVal && validStatuses.includes(statusVal)) {
      params.push(statusVal);
      cond.push(`ed.status = $${params.length}`);
    } else {
      cond.push("ed.status IN ('approved','pending','draft','rejected')");
    }
    if (from) { params.push(from); cond.push(`ei.use_date >= $${params.length}`); }
    if (to) { params.push(to); cond.push(`ei.use_date <= $${params.length}`); }
    if (project) { params.push(project); cond.push(`ei.project_name = $${params.length}`); }
    if (account_item_id) { params.push(account_item_id); cond.push(`ei.account_item_id = $${params.length}`); }
    else if (account_item_name) { params.push(account_item_name); cond.push(`ei.account_item_name = $${params.length}`); }
    if (user_name) { params.push(`%${user_name}%`); cond.push(`ed.user_name LIKE $${params.length}`); }
    if (description) { params.push(`%${description}%`); cond.push(`ei.description LIKE $${params.length}`); }
    const whereClause = cond.join(' AND ');
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
  const { rows, user_name, card_no, project_name: defaultProjectName } = req.body;
  if (!rows?.length) return res.status(400).json({ error: 'No data' });
  if (!card_no || !String(card_no).trim()) return res.status(400).json({ error: '카드번호를 입력해 주세요.' });
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
    const project_name = (defaultProjectName && String(defaultProjectName).trim()) || items[0].project_name || '미지정';
    if (defaultProjectName && String(defaultProjectName).trim()) {
      items.forEach(i => { i.project_name = defaultProjectName.trim(); });
    }
    const dates = items.map(i => i.use_date).sort();
    const totalCard = items.reduce((s, i) => s + i.card_amount, 0);
    const totalCash = items.reduce((s, i) => s + i.cash_amount, 0);
    const docNo = `CARD-IMPORT-${Date.now()}`;
    const r = await db.run(`
      INSERT INTO expense_documents (doc_no, user_name, project_name, period_start, period_end, card_no, status, total_card_amount, total_cash_amount)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8) RETURNING id
    `, [docNo, user_name || 'import', project_name, dates[0], dates[dates.length - 1], card_no || null, totalCard, totalCash]);
    const docId = r.rows[0].id;
    const csvItems = items.map(i => {
      const card = safeInt(i.card_amount);
      const cash = safeInt(i.cash_amount);
      return { ...i, card_amount: card, cash_amount: cash, total_amount: card + cash, account_item_id: safeId(i.account_item_id) || i.account_item_id };
    });
    await db.insertExpenseItemsCsv(null, csvItems, docId);
    res.json({ id: docId, doc_no: docNo, count: items.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function nameToCode(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\uac00-\ud7af]/g, '') || null;
}

app.post('/api/projects', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '현장명 필수' });
  try {
    const code = nameToCode(name.trim()) || null;
    const r = await db.run('INSERT INTO projects (code, name) VALUES ($1, $2) RETURNING id', [code, name.trim()]);
    res.json({ id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/account-items', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '항목명 필수' });
  try {
    const code = nameToCode(name.trim()) || `item_${Date.now()}`;
    const r = await db.run('INSERT INTO account_items (code, name) VALUES ($1, $2) RETURNING id', [code, name.trim()]);
    res.json({ id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/account-items/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  if (!name?.trim()) return res.status(400).json({ error: '항목명 필수' });
  try {
    const code = nameToCode(name.trim()) || null;
    await db.run('UPDATE account_items SET code=$1, name=$2 WHERE id=$3', [code, name.trim(), id]);
    await db.run('UPDATE expense_items SET account_item_name=$1 WHERE account_item_id=$2', [name.trim(), id]);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  if (!name?.trim()) return res.status(400).json({ error: '현장명 필수' });
  try {
    const code = nameToCode(name.trim()) || null;
    await db.run('UPDATE projects SET code=$1, name=$2 WHERE id=$3', [code, name.trim(), id]);
    await db.run('UPDATE expense_items SET project_name=$1 WHERE project_id=$2', [name.trim(), id]);
    await db.run('UPDATE expense_documents SET project_name=$1 WHERE project_id=$2', [name.trim(), id]);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/account-items/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const r = await db.run('DELETE FROM account_items WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: '사용 중인 항목은 삭제할 수 없습니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const r = await db.run('DELETE FROM projects WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: '사용 중인 현장은 삭제할 수 없습니다.' });
    res.status(500).json({ error: e.message });
  }
});

// 사용자별 카드 CRUD
app.get('/api/user-cards', async (req, res) => {
  const user_name = req.query.user_name;
  const all = req.query.all === '1' || req.query.all === 'true';
  if (all && req.user && (req.user.is_admin || req.user.role === 'admin')) {
    try {
      const rows = await db.query('SELECT id, user_name, card_no, label, is_default FROM user_cards ORDER BY user_name, is_default DESC, id');
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (!user_name?.trim()) return res.json([]);
  try {
    const rows = await db.query('SELECT id, user_name, card_no, label, is_default FROM user_cards WHERE user_name = $1 ORDER BY is_default DESC, id', [user_name.trim()]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user-cards', async (req, res) => {
  const { user_name, card_no, label, is_default } = req.body;
  if (!user_name?.trim() || !card_no?.trim()) return res.status(400).json({ error: '사용자명과 카드번호 필수' });
  try {
    if (is_default) {
      await db.run('UPDATE user_cards SET is_default = false WHERE user_name = $1', [user_name.trim()]);
    }
    const r = await db.run(
      'INSERT INTO user_cards (user_name, card_no, label, is_default) VALUES ($1, $2, $3, $4) RETURNING id, user_name, card_no, label, is_default',
      [user_name.trim(), (card_no || '').trim(), (label || '').trim() || null, !!is_default]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/user-cards/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { card_no, label, is_default } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const row = await db.queryOne('SELECT user_name, card_no, label, is_default FROM user_cards WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '카드를 찾을 수 없습니다.' });
    if (is_default) {
      await db.run('UPDATE user_cards SET is_default = false WHERE user_name = $1', [row.user_name]);
    }
    const newCardNo = card_no !== undefined ? (card_no && String(card_no).trim()) || null : row.card_no;
    const newLabel = label !== undefined ? (label && String(label).trim()) || null : row.label;
    const newIsDefault = is_default !== undefined ? !!is_default : row.is_default;
    await db.run(
      'UPDATE user_cards SET card_no = $1, label = $2, is_default = $3 WHERE id = $4',
      [newCardNo, newLabel, newIsDefault, id]
    );
    const updated = await db.queryOne('SELECT id, user_name, card_no, label, is_default FROM user_cards WHERE id = $1', [id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/user-cards/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const r = await db.run('DELETE FROM user_cards WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '카드를 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 사용자별 기본 설정 (기본 현장)
app.get('/api/user-settings', async (req, res) => {
  const user_name = req.query.user_name;
  if (!user_name?.trim()) return res.json({ default_project_id: null });
  try {
    const row = await db.queryOne('SELECT default_project_id FROM user_settings WHERE user_name = $1', [user_name.trim()]);
    res.json({ default_project_id: row?.default_project_id ?? null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/user-settings', async (req, res) => {
  const { user_name, default_project_id } = req.body;
  if (!user_name?.trim()) return res.status(400).json({ error: '사용자명 필수' });
  try {
    await db.run(
      `INSERT INTO user_settings (user_name, default_project_id) VALUES ($1, $2)
       ON CONFLICT (user_name) DO UPDATE SET default_project_id = $2, updated_at = now()`,
      [user_name.trim(), default_project_id && !isNaN(parseInt(default_project_id, 10)) ? parseInt(default_project_id, 10) : null]
    );
    const row = await db.queryOne('SELECT default_project_id FROM user_settings WHERE user_name = $1', [user_name.trim()]);
    res.json({ default_project_id: row?.default_project_id ?? null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const adminCache = new Map(); // userId -> { isAdmin, cachedAt }
const ADMIN_CACHE_TTL_MS = 60 * 1000;

const requireAdmin = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  const cached = adminCache.get(req.user.id);
  if (cached && Date.now() - cached.cachedAt < ADMIN_CACHE_TTL_MS) {
    req.user.is_admin = cached.isAdmin;
    req.user.role = cached.role;
    return next();
  }
  try {
    const user = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
    if (user && (user.is_admin === true || user.role === 'admin')) {
      adminCache.set(req.user.id, { isAdmin: user.is_admin, role: user.role, cachedAt: Date.now() });
      req.user.is_admin = user.is_admin;
      req.user.role = user.role;
      return next();
    }
  } catch (e) { /* 무시 */ }
  return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
};

// 역할 API (파라미터 라우트보다 먼저 등록)
app.get('/api/admin/roles', requireAdmin, async (req, res) => {
  try {
    const rows = await db.query('SELECT id, code, label, display_order FROM roles ORDER BY display_order, id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/roles', requireAdmin, async (req, res) => {
  const { label } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: '역할 이름을 입력하세요.' });
  const c = nameToCode(label.trim()) || `role_${Date.now()}`;
  try {
    const r = await db.run('INSERT INTO roles (code, label, display_order) VALUES ($1, $2, 99) RETURNING id, code, label', [c, label.trim()]);
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 존재하는 역할 코드입니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/roles/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { label } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  if (!label?.trim()) return res.status(400).json({ error: '역할 이름을 입력하세요.' });
  try {
    await db.run('UPDATE roles SET label = $1 WHERE id = $2', [label.trim(), id]);
    const row = await db.queryOne('SELECT id, code, label FROM roles WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '역할을 찾을 수 없습니다.' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/roles/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const row = await db.queryOne('SELECT code FROM roles WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '역할을 찾을 수 없습니다.' });
    if (row.code === 'admin') return res.status(400).json({ error: '관리자 역할은 삭제할 수 없습니다.' });
    const users = await db.query('SELECT id FROM auth_users WHERE role = $1', [row.code]);
    if (users.length > 0) return res.status(400).json({ error: `해당 역할을 가진 사용자가 ${users.length}명 있어 삭제할 수 없습니다.` });
    await db.run('DELETE FROM role_menus WHERE role = $1', [row.code]);
    await db.run('DELETE FROM roles WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/companies', requireAdmin, async (req, res) => {
  try {
    const withSettings = req.query.with_settings === '1' || req.query.with_settings === 'true';
    const [rows, settingsRow] = await Promise.all([
      db.query('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default FROM companies ORDER BY is_default DESC, id'),
      withSettings ? db.queryOne(`
        SELECT auto_approve FROM company_settings
        WHERE company_id = COALESCE(
          (SELECT id FROM companies WHERE is_default = true LIMIT 1),
          (SELECT id FROM companies ORDER BY id LIMIT 1)
        )
        LIMIT 1
      `) : Promise.resolve(null),
    ]);
    if (withSettings) {
      res.json({ companies: rows, auto_approve: settingsRow?.auto_approve ?? false });
    } else {
      res.json(rows);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/companies', requireAdmin, async (req, res) => {
  const { name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '회사명 필수' });
  try {
    const rows = await db.query('SELECT id FROM companies');
    const isFirst = rows.length === 0;
    const r = await db.run(
      `INSERT INTO companies (name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default`,
      [name.trim(), logo_url || null, address?.trim() || null, ceo_name?.trim() || null, founded_date?.trim() || null,
       business_reg_no?.trim() || null, tel?.trim() || null, fax?.trim() || null, email?.trim() || null, copyright_text?.trim() || null, isFirst]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/companies/:id/set-default', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    await db.run('UPDATE companies SET is_default = false');
    await db.run('UPDATE companies SET is_default = true WHERE id = $1', [id]);
    const row = await db.queryOne('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default FROM companies WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '회사를 찾을 수 없습니다.' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/companies/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    await db.run(
      `UPDATE companies SET name = COALESCE($1, name), logo_url = $2, address = $3, ceo_name = $4, founded_date = $5,
       business_reg_no = $6, tel = $7, fax = $8, email = $9, copyright_text = $10 WHERE id = $11`,
      [name?.trim() || null, logo_url || null, address?.trim() || null, ceo_name?.trim() || null, founded_date?.trim() || null,
       business_reg_no?.trim() || null, tel?.trim() || null, fax?.trim() || null, email?.trim() || null, copyright_text?.trim() || null, id]
    );
    const row = await db.queryOne('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default FROM companies WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '회사를 찾을 수 없습니다.' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const users = await db.query('SELECT id FROM auth_users WHERE company_id = $1', [id]);
    if (users.length > 0) return res.status(400).json({ error: `해당 회사 소속 사용자 ${users.length}명이 있어 삭제할 수 없습니다.` });
    const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
    if (def?.id === id) return res.status(400).json({ error: '대표 회사는 삭제할 수 없습니다. 다른 회사를 대표로 설정 후 삭제하세요.' });
    await db.run('DELETE FROM approval_sequences WHERE company_id = $1', [id]);
    await db.run('DELETE FROM company_settings WHERE company_id = $1', [id]);
    await db.run('DELETE FROM companies WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { company_id, project_id, role, name, limit, offset } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (company_id != null && company_id !== '') {
      params.push(parseInt(company_id, 10));
      conditions.push(`au.company_id = $${idx++}`);
    }
    if (project_id != null && project_id !== '') {
      params.push(parseInt(project_id, 10));
      conditions.push(`au.project_id = $${idx++}`);
    }
    if (role != null && role !== '') {
      params.push(role.trim());
      conditions.push(`au.role = $${idx++}`);
    }
    if (name != null && name.trim() !== '') {
      const nameLike = `%${name.trim()}%`;
      params.push(nameLike, nameLike);
      conditions.push(`(au.name ILIKE $${idx++} OR au.email ILIKE $${idx++})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = limit != null ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    const offsetVal = offset != null ? Math.max(0, parseInt(offset, 10)) : 0;

    const rowsRes = await db.query(`
      SELECT au.id, au.email, au.name, au.role, au.is_admin, au.is_approved, au.company_id, au.project_id, au.created_at,
             p.name as project_name,
             COUNT(*) OVER ()::int as total
      FROM auth_users au
      LEFT JOIN projects p ON p.id = au.project_id
      ${where}
      ORDER BY au.is_approved ASC, au.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limitVal, offsetVal]);
    const total = rowsRes.length ? parseInt(rowsRes[0].total || 0, 10) : 0;
    const rows = rowsRes.map(({ total: _, ...r }) => r);
    res.json({ rows, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { email, password, name, role, company_id, project_id, is_approved } = req.body;
  if (!email?.trim() || !password) return res.status(400).json({ error: '이메일과 비밀번호 필수' });
  try {
    const hash = await auth.hashPassword(password);
    const newRole = role || 'author';
    const isAdminRole = newRole === 'admin';
    const r = await db.run(
      `INSERT INTO auth_users (company_id, project_id, email, password_hash, name, role, is_admin, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, name, role`,
      [company_id || null, project_id ? parseInt(project_id, 10) : null, email.trim(), hash, (name || '').trim() || email.split('@')[0], newRole, isAdminRole, !!is_approved]
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, role, password, project_id, company_id, is_approved, email } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const newRole = role || 'author';
    const isAdminRole = newRole === 'admin';
    const updates = ['name = $1', 'role = $2', 'project_id = $3', 'company_id = $4', 'is_approved = $5', 'is_admin = $6'];
    const params = [(name || '').trim(), newRole, project_id ? parseInt(project_id, 10) : null, company_id ? parseInt(company_id, 10) : null, !!is_approved, isAdminRole];
    let idx = 7;
    if (email !== undefined && email !== null) {
      const em = String(email).trim();
      if (!em) return res.status(400).json({ error: '이메일을 입력하세요.' });
      const existing = await db.queryOne('SELECT id FROM auth_users WHERE email = $1 AND id != $2', [em, id]);
      if (existing) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
      params.push(em);
      updates.push(`email = $${idx}`);
      idx++;
    }
    if (password && password.length >= 4) {
      params.push(await auth.hashPassword(password));
      updates.push(`password_hash = $${idx}`);
      idx++;
    }
    params.push(id);
    await db.run(`UPDATE auth_users SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    const row = await db.queryOne('SELECT au.id, au.email, au.name, au.role, au.is_admin, au.is_approved, au.company_id, au.project_id, p.name as project_name FROM auth_users au LEFT JOIN projects p ON p.id = au.project_id WHERE au.id = $1', [id]);
    if (!row) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    await db.run('UPDATE auth_users SET is_approved = true WHERE id = $1', [id]);
    const row = await db.queryOne('SELECT id, email, name, role, is_approved FROM auth_users WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/role-menus', requireAdmin, async (req, res) => {
  try {
    const rows = await db.query('SELECT role, menu_path FROM role_menus ORDER BY role, menu_path');
    const byRole = {};
    rows.forEach(r => {
      if (!byRole[r.role]) byRole[r.role] = [];
      byRole[r.role].push(r.menu_path);
    });
    res.json(byRole);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/role-menus', requireAdmin, async (req, res) => {
  const { role, menus } = req.body;
  if (!role) return res.status(400).json({ error: 'role 필수' });
  try {
    await db.run('DELETE FROM role_menus WHERE role = $1', [role]);
    for (const m of (menus || [])) {
      if (m?.trim()) await db.run('INSERT INTO role_menus (role, menu_path) VALUES ($1, $2)', [role, m.trim()]);
    }
    const rows = await db.query('SELECT menu_path FROM role_menus WHERE role = $1', [role]);
    res.json(rows.map(r => r.menu_path));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/approval-sequences', requireAdmin, async (req, res) => {
  try {
    const rows = await db.query('SELECT id, company_id, role, sort_order FROM approval_sequences ORDER BY company_id, sort_order');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/batch/approval-sequence', requireAdmin, async (req, res) => {
  try {
    const [seqRows, companyRow, rolesData] = await Promise.all([
      db.query('SELECT id, company_id, role, sort_order FROM approval_sequences ORDER BY company_id, sort_order'),
      db.queryOne('SELECT id, name, logo_url FROM companies WHERE is_default = true')
        .then(r => r || db.queryOne('SELECT id, name, logo_url FROM companies ORDER BY id LIMIT 1')),
      db.query('SELECT id, code, label, display_order FROM roles ORDER BY display_order, id')
    ]);
    const company = companyRow ? companyRow.id : null;
    const sequences = (seqRows || []).filter(r => r.company_id === company);
    res.json({ sequences: sequences.length ? sequences : [], company: companyRow, roles: rolesData || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/batch/role-permissions', requireAdmin, async (req, res) => {
  try {
    const [rolesData, menuRows] = await Promise.all([
      db.query('SELECT id, code, label, display_order FROM roles ORDER BY display_order, id'),
      db.query('SELECT role, menu_path FROM role_menus ORDER BY role, menu_path')
    ]);
    const byRole = {};
    (menuRows || []).forEach(r => {
      if (!byRole[r.role]) byRole[r.role] = [];
      byRole[r.role].push(r.menu_path);
    });
    res.json({ roles: rolesData || [], roleMenus: byRole });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/batch/users-page', requireAdmin, async (req, res) => {
  try {
    const { company_id, project_id, role, name, limit, offset } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (company_id != null && company_id !== '') { params.push(parseInt(company_id, 10)); conditions.push(`au.company_id = $${idx++}`); }
    if (project_id != null && project_id !== '') { params.push(parseInt(project_id, 10)); conditions.push(`au.project_id = $${idx++}`); }
    if (role != null && role !== '') { params.push(role.trim()); conditions.push(`au.role = $${idx++}`); }
    if (name != null && name.trim() !== '') {
      const nameLike = `%${name.trim()}%`;
      params.push(nameLike, nameLike);
      conditions.push(`(au.name ILIKE $${idx++} OR au.email ILIKE $${idx++})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = limit != null ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    const offsetVal = offset != null ? Math.max(0, parseInt(offset, 10)) : 0;

    const [usersRes, rolesData, menuRows, projectsData, companiesData] = await Promise.all([
      db.query(`
        SELECT au.id, au.email, au.name, au.role, au.is_admin, au.is_approved, au.company_id, au.project_id, au.created_at,
               p.name as project_name, COUNT(*) OVER ()::int as total
        FROM auth_users au
        LEFT JOIN projects p ON p.id = au.project_id
        ${where}
        ORDER BY au.is_approved ASC, au.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...params, limitVal, offsetVal]),
      db.query('SELECT id, code, label, display_order FROM roles ORDER BY display_order, id'),
      db.query('SELECT role, menu_path FROM role_menus ORDER BY role, menu_path'),
      db.query('SELECT id, name FROM projects ORDER BY name'),
      db.query('SELECT id, name, is_default FROM companies ORDER BY is_default DESC, id')
    ]);
    const total = usersRes.length ? parseInt(usersRes[0].total || 0, 10) : 0;
    const rows = usersRes.map(({ total: _, ...r }) => r);
    const byRole = {};
    (menuRows || []).forEach(r => { if (!byRole[r.role]) byRole[r.role] = []; byRole[r.role].push(r.menu_path); });
    res.json({ rows, total, roles: rolesData || [], roleMenus: byRole, projects: projectsData || [], companies: companiesData || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/approval-sequences', requireAdmin, async (req, res) => {
  const { company_id, sequences } = req.body;
  const cid = company_id && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
  try {
    if (cid) await db.run('DELETE FROM approval_sequences WHERE company_id = $1', [cid]);
    for (let i = 0; i < (sequences || []).length; i++) {
      const s = sequences[i];
      if (s?.role) await db.run('INSERT INTO approval_sequences (company_id, role, sort_order) VALUES ($1, $2, $3)', [cid, s.role, i + 1]);
    }
    const rows = await db.query('SELECT role, sort_order FROM approval_sequences WHERE company_id = $1 ORDER BY sort_order', [cid]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/edit-history', requireAdmin, async (req, res) => {
  const { limit, offset } = req.query;
  const lim = limit != null ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
  const off = offset != null ? Math.max(0, parseInt(offset, 10)) : 0;
  try {
    const rowsRes = await db.query(`
      SELECT aeh.id, aeh.document_id, aeh.admin_name, aeh.document_status, aeh.created_at,
             ed.doc_no, ed.user_name, ed.project_name, ed.period_start, ed.period_end,
             COUNT(*) OVER ()::int as total
      FROM admin_edit_history aeh
      JOIN expense_documents ed ON ed.id = aeh.document_id
      ORDER BY aeh.created_at DESC
      LIMIT $1 OFFSET $2
    `, [lim, off]);
    const total = rowsRes.length ? parseInt(rowsRes[0].total || 0, 10) : 0;
    const rows = rowsRes.map(({ total: _, ...r }) => r);
    res.json({ rows, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/company-settings', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
    const cid = def?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    const row = cid ? await db.queryOne('SELECT auto_approve FROM company_settings WHERE company_id = $1', [cid]) : null;
    res.json({ auto_approve: row?.auto_approve ?? false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/company-settings', requireAdmin, async (req, res) => {
  const { company_id, auto_approve } = req.body;
  const cid = company_id && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : (await db.queryOne('SELECT id FROM companies LIMIT 1'))?.id;
  if (!cid) return res.status(400).json({ error: '회사 정보가 없습니다.' });
  try {
    await db.run(
      'INSERT INTO company_settings (company_id, auto_approve) VALUES ($1, $2) ON CONFLICT (company_id) DO UPDATE SET auto_approve = $2',
      [cid, !!auto_approve]
    );
    res.json({ auto_approve: !!auto_approve });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/batch-approval-excel', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { period_from, period_to, status, project, card_no } = req.query;
  try {
    const ExcelJS = require('exceljs');
    const buildWhere = (strict = true) => {
      const where = [];
      const params = [];
      if (status) { params.push(status); where.push(`ed.status = $${params.length}`); }
      if (project) { params.push(project); where.push(`ed.project_name = $${params.length}`); }
      if (card_no != null && String(card_no).trim() !== '') {
        params.push(`%${String(card_no).trim()}%`);
        where.push(`(ed.card_no ILIKE $${params.length})`);
      }
      if (strict) {
        if (period_from) { params.push(period_from); where.push(`ed.period_end >= $${params.length}`); }
        if (period_to) { params.push(period_to); where.push(`ed.period_start <= $${params.length}`); }
      }
      return { where, params };
    };
    let { where, params } = buildWhere(true);
    let whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    let items = await db.query(`
      SELECT ei.use_date, ei.project_name, ei.account_item_name, ei.description,
        ei.card_amount, ei.cash_amount, ei.total_amount, ei.remark,
        ed.card_no, ed.user_name, ed.period_start, ed.period_end
      FROM expense_items ei
      JOIN expense_documents ed ON ed.id = ei.document_id${whereClause}
      ORDER BY ei.use_date, ei.id
    `, params);
    if (items.length === 0) {
      const fallback = buildWhere(false);
      whereClause = fallback.where.length ? ' WHERE ' + fallback.where.join(' AND ') : '';
      items = await db.query(`
        SELECT ei.use_date, ei.project_name, ei.account_item_name, ei.description,
          ei.card_amount, ei.cash_amount, ei.total_amount, ei.remark,
          ed.card_no, ed.user_name, ed.period_start, ed.period_end
        FROM expense_items ei
        JOIN expense_documents ed ON ed.id = ei.document_id${whereClause}
        ORDER BY ei.use_date DESC, ei.id
        LIMIT 2000
      `, fallback.params);
    }
    const cardLabels = {};
    const ucRows = await db.query('SELECT card_no, label FROM user_cards');
    ucRows.forEach(r => { if (r.card_no && !cardLabels[r.card_no]) cardLabels[r.card_no] = r.label; });
    const maskCard = (c) => c ? String(c).replace(/(\d{4})-(\d{4})-(\d{4})-(\d+)/, '$1-$2-$3-****') : '-';
    const isDisplayCardFormat = (c) => c && /^\d{4}-\d{4}-\d{4}-\d+$/.test(String(c).trim());
    const formatDateKor = (dStr) => {
      if (!dStr) return '';
      const m = String(dStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1]}년 ${m[2]}월 ${m[3]}일` : dStr;
    };
    const toFilenameDate = (dStr) => {
      if (!dStr) return '';
      const m = String(dStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1].slice(2)}.${m[2]}.${m[3]}` : dStr;
    };
    const dates = items.map(i => i.use_date).filter(Boolean).sort();
    const periodLabel = dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '';
    const periodEndForSubmit = dates.length ? dates[dates.length - 1] : (period_to || '');
    const fromDate = period_from || (dates.length ? dates[0] : '');
    const toDate = period_to || (dates.length ? dates[dates.length - 1] : '');

    const thinBorder = { style: 'thin', color: { argb: 'FF000000' } };
    const fullBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    const applyGridBorders = (ws, startRow, startCol, endRow, endCol) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          ws.getCell(r, c).border = fullBorder;
        }
      }
    };

    const addSheet = (wb, sheetItems, tabName, cardNoForHeader, userProjectForHeader, totalCardForHeader, submitterName) => {
      const safeTabName = tabName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 31);
      const ws = wb.addWorksheet(safeTabName, { views: [{ showGridLines: true }] });
      ws.columns = [
        { width: 12 }, { width: 18 }, { width: 14 }, { width: 28 },
        { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 8 }, { width: 8 },
      ];

      const cardVal = cardNoForHeader != null ? (isDisplayCardFormat(cardNoForHeader) ? maskCard(cardNoForHeader) : cardNoForHeader) : '';
      const userVal = userProjectForHeader || '';
      const totalVal = totalCardForHeader != null ? totalCardForHeader : '';

      ws.mergeCells('A1:D2');
      ws.getCell('A1').value = `카드사용내역서 (${periodLabel})`;
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('A1').font = { bold: true, size: 12 };
      ws.getCell('A1').border = fullBorder;

      ws.mergeCells('E1:E2');
      ws.getCell('E1').value = '결재';
      ws.getCell('E1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('F1').value = '작성';
      ws.getCell('G1').value = '검토';
      ws.getCell('H1').value = '검토';
      ws.getCell('I1').value = '승인';
      [5, 6, 7, 8, 9].forEach(c => { ws.getCell(1, c).alignment = { horizontal: 'center', vertical: 'middle' }; });
      applyGridBorders(ws, 1, 5, 5, 9);
      [5, 6, 7, 8, 9].forEach(c => {
        const cell = ws.getCell(3, c);
        cell.border = { top: thinBorder, bottom: thinBorder };
      });
      ws.mergeCells('E4:F4');
      ws.mergeCells('E5:F5');
      ws.getCell('E4').value = '-';
      [2, 3, 4, 5].forEach(r => { ws.getRow(r).height = 26; });

      ws.getCell('A4').value = '카드번호';
      ws.getCell('B4').value = cardVal;
      ws.getCell('C4').value = '';
      ws.getCell('D4').value = '개인용도';
      ws.getCell('A5').value = '사용자';
      ws.getCell('B5').value = userVal;
      ws.getCell('C5').value = '';
      ws.getCell('D5').value = '공적용도';
      ws.getCell('E5').value = totalVal;
      if (typeof totalVal === 'number') ws.getCell('E5').numFmt = '#,##0';
      ws.mergeCells('H4:I4');
      ws.getCell('H4').value = '비고';
      ws.getCell('H4').alignment = { horizontal: 'center', vertical: 'middle' };
      applyGridBorders(ws, 4, 1, 5, 9);

      const headerRow = 7;
      ws.getCell(headerRow, 1).value = '날짜';
      ws.getCell(headerRow, 2).value = '현장명';
      ws.getCell(headerRow, 3).value = '항목';
      ws.getCell(headerRow, 4).value = '세부사용내역';
      ws.getCell(headerRow, 5).value = '카드';
      ws.getCell(headerRow, 6).value = '현금';
      ws.getCell(headerRow, 7).value = '합계금액';
      ws.getCell(headerRow, 8).value = '비고';
      ws.getCell(headerRow, 9).value = '확인';

      let dataStartRow = 8;
      let totalCardAmt = 0, totalCashAmt = 0, totalAmt = 0;
      sheetItems.forEach((i, idx) => {
        const r = dataStartRow + idx;
        ws.getCell(r, 1).value = i.use_date;
        ws.getCell(r, 2).value = i.project_name;
        ws.getCell(r, 3).value = i.account_item_name;
        ws.getCell(r, 4).value = i.description || '';
        ws.getCell(r, 5).value = i.card_amount ?? 0;
        ws.getCell(r, 6).value = i.cash_amount ?? 0;
        ws.getCell(r, 7).value = i.total_amount ?? 0;
        ws.getCell(r, 8).value = i.remark || '';
        ws.getCell(r, 9).value = '';
        totalCardAmt += i.card_amount ?? 0;
        totalCashAmt += i.cash_amount ?? 0;
        totalAmt += i.total_amount ?? 0;
        [5, 6, 7].forEach(col => { ws.getCell(r, col).numFmt = '#,##0'; });
      });
      let dataEndRow = sheetItems.length > 0 ? dataStartRow + sheetItems.length - 1 : headerRow;
      if (sheetItems.length > 0) {
        const totalRow = dataEndRow + 1;
        ws.mergeCells(totalRow, 1, totalRow, 2);
        ws.getCell(totalRow, 1).value = '합계';
        ws.getCell(totalRow, 5).value = totalCardAmt;
        ws.getCell(totalRow, 6).value = totalCashAmt;
        ws.getCell(totalRow, 7).value = totalAmt;
        [5, 6, 7].forEach(col => { ws.getCell(totalRow, col).numFmt = '#,##0'; });
        applyGridBorders(ws, totalRow, 1, totalRow, 9);
        dataEndRow = totalRow;
      }
      applyGridBorders(ws, headerRow, 1, dataEndRow, 9);

      const submitterRow = dataEndRow + 3;
      ws.mergeCells(submitterRow, 1, submitterRow, 9);
      ws.getCell(submitterRow, 1).value = '상기와 같이 카드사용내역을 제출하오니 검토후 승인하여 주시기 바랍니다.';
      ws.getCell(submitterRow, 1).alignment = { horizontal: 'center' };
      applyGridBorders(ws, submitterRow, 1, submitterRow, 9);

      ws.mergeCells(submitterRow + 2, 1, submitterRow + 2, 9);
      ws.getCell(submitterRow + 2, 1).value = formatDateKor(periodEndForSubmit);
      ws.getCell(submitterRow + 2, 1).alignment = { horizontal: 'center' };
      applyGridBorders(ws, submitterRow + 2, 1, submitterRow + 2, 9);

      ws.mergeCells(submitterRow + 4, 1, submitterRow + 4, 9);
      ws.getCell(submitterRow + 4, 1).value = `제출자: ${submitterName || ''}(인)`;
      ws.getCell(submitterRow + 4, 1).alignment = { horizontal: 'center' };
      applyGridBorders(ws, submitterRow + 4, 1, submitterRow + 4, 9);
    };

    const wb = new ExcelJS.Workbook();
    wb.views = [{ activeSheet: 0, visibility: 'visible' }];
    const byCard = {};
    const cashItems = [];
    items.forEach(i => {
      const c = (i.card_no || '').trim() || '__nocard__';
      if (!byCard[c]) byCard[c] = [];
      byCard[c].push(i);
      if ((i.cash_amount || 0) > 0) cashItems.push(i);
    });

    const cardKeys = Object.keys(byCard).filter(k => k !== '__nocard__').sort();
    if (cardKeys.length === 0 && byCard['__nocard__']) cardKeys.push('__nocard__');

    for (const c of cardKeys) {
      const list = byCard[c] || [];
      const totalCard = list.reduce((s, i) => s + (i.card_amount || 0), 0);
      const first = list[0];
      const tabLabel = (c !== '__nocard__' && isDisplayCardFormat(c)) ? maskCard(c) : (c !== '__nocard__' ? (cardLabels[c] || '미지정') : '미지정');
      const tabName = c !== '__nocard__' ? tabLabel : '미지정카드';
      addSheet(wb, list, tabName, c !== '__nocard__' ? c : null, first ? `${first.user_name || ''} (${first.project_name || ''})` : null, totalCard, first?.user_name || '');
    }
    if (cashItems.length > 0) {
      const first = cashItems[0];
      addSheet(wb, cashItems, '현금사용내역', null, null, null, first?.user_name || '');
    }
    if (cardKeys.length === 0 && cashItems.length === 0) {
      addSheet(wb, [], '카드사용내역서', null, null, null, '');
      const ws = wb.worksheets[wb.worksheets.length - 1];
      ws.mergeCells('A8:I8');
      ws.getCell('A8').value = '조회된 데이터가 없습니다.';
      ws.getCell('A8').alignment = { horizontal: 'center' };
      applyGridBorders(ws, 8, 1, 8, 9);
    }

    const buf = await wb.xlsx.writeBuffer();
    const fnFrom = toFilenameDate(fromDate);
    const fnTo = toFilenameDate(toDate);
    const filename = (fnFrom && fnTo) ? `카드및현금사용-${fnFrom}~${fnTo}.xlsx` : '카드및현금사용.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/ceo-excel', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.user.is_admin && req.user.role !== 'ceo') return res.status(403).json({ error: 'CEO 또는 관리자 권한이 필요합니다.' });
  try {
    const XLSX = require('xlsx');
    const rows = await db.query(`
      SELECT ei.id, ei.document_id, ei.use_date, ei.project_name, ei.account_item_name, ei.description, ei.card_amount, ei.cash_amount, ei.total_amount, ed.status, ed.user_name
      FROM expense_items ei
      LEFT JOIN expense_documents ed ON ed.id = ei.document_id
      ORDER BY ei.use_date DESC, ei.id
    `);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      문서ID: r.document_id, 사용일: r.use_date, 현장: r.project_name, 항목: r.account_item_name,
      적요: r.description, 카드: r.card_amount, 현금: r.cash_amount, 합계: r.total_amount,
      상태: r.status, 작성자: r.user_name,
    })));
    XLSX.utils.book_append_sheet(wb, ws, '사용내역');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=ceo-approval-list.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 프론트 서빙: 개발 시 항상 Vite, 프로덕션만 static
const publicDir = path.join(__dirname, '..', 'public');
const clientDir = path.join(__dirname, '..', 'client');
const isProd = process.env.NODE_ENV === 'production';
const useStatic = isProd && require('fs').existsSync(path.join(publicDir, 'index.html'));

async function start() {
  if (useStatic) {
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  } else {
    const { createServer } = require('vite');
    const vite = await createServer({
      root: clientDir,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // /api 요청은 Vite를 건너뛰고 기존 라우트에서 처리
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      vite.middlewares(req, res, next);
    });
  }

  const PORT = process.env.PORT || 3000;
  if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
  }
}

if (!process.env.VERCEL) start().catch(console.error);

module.exports = app;
