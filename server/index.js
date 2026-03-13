require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const hangulRomanization = require('hangul-romanization');
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
  const { email, password, name, project_id, plan_id } = req.body;
  if (!email?.trim() || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
  if (password.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
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

const COMPANY_DEFAULTS = { name: 'PMIS', logo_url: null, address: null, ceo_name: null, founded_date: null, business_reg_no: null, tel: null, fax: null, email: null, copyright_text: null };

app.get('/api/companies', async (req, res) => {
  try {
    if (req.query.list === '1' || req.query.list === 'true') {
      if (!req.user?.id) return res.json([]);
      const userRow = await db.queryOne('SELECT id, is_admin FROM auth_users WHERE id = $1', [req.user.id]);
      const mine = req.query.mine === '1' || req.query.mine === 'true';
      const rows = userRow
        ? (mine
            ? await (async () => {
                const ids = await getCompanyIdsForUserIncludingSameEmail(userRow.id);
                if (ids.length === 0) return [];
                return db.query('SELECT c.id, c.name, c.is_default FROM companies c WHERE c.id = ANY($1::int[]) ORDER BY c.id', [ids]);
              })()
            : await getCompaniesForUser({ id: userRow.id, is_admin: userRow.is_admin }))
        : [];
      return res.json(rows || []);
    }
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
    const user = await db.queryOne('SELECT id, email, name, role, is_admin, company_id FROM auth_users WHERE id = $1', [req.user.id]);
    const repCompanyId = await getUserRepresentativeCompany(req.user.id);
    const companyRow = repCompanyId
      ? await db.queryOne('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text FROM companies WHERE id = $1', [repCompanyId])
      : await db.queryOne('SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text FROM companies ORDER BY id LIMIT 1');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const isSuperAdmin = user.is_admin === true;
    const isCompanyAdmin = user.role === 'admin' && !user.is_admin;
    let menus;
    if (isSuperAdmin) {
      menus = ['/', '/expense/new', '/expenses', '/import', '/approval-processing', '/card-management', '/masters', '/settings', '/admin/company', '/admin/approval-sequence', '/admin/permissions', '/admin/edit-history', '/admin/super'];
    } else if (isCompanyAdmin) {
      const companyId = repCompanyId || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
      const rows = companyId ? await db.query('SELECT menu_path FROM role_menus WHERE company_id = $1 AND role = $2', [companyId, 'company_admin']) : [];
      menus = (rows || []).map(r => r.menu_path);
    } else {
      const companyId = repCompanyId || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
      const rows = companyId ? await db.query('SELECT menu_path FROM role_menus WHERE company_id = $1 AND role = $2', [companyId, user.role]) : [];
      menus = (rows || []).map(r => r.menu_path);
    }
    const company = companyRow ? { ...COMPANY_DEFAULTS, ...companyRow } : COMPANY_DEFAULTS;
    let subscription = null;
    if (repCompanyId) {
      const subRow = await db.queryOne(
        `SELECT cs.id, cs.status, cs.started_at, cs.ends_at, sp.code, sp.name, sp.price_monthly, sp.max_users, sp.features_json, sp.is_trial, sp.trial_days
         FROM company_subscriptions cs
         JOIN subscription_plans sp ON sp.id = cs.plan_id
         WHERE cs.company_id = $1 AND cs.status = 'active'`,
        [repCompanyId]
      );
      if (subRow) {
        subscription = { plan: subRow.code, planName: subRow.name, maxUsers: subRow.max_users, status: subRow.status, startedAt: subRow.started_at, endsAt: subRow.ends_at, isTrial: subRow.is_trial, trialDays: subRow.trial_days };
      }
    }
    const userOut = { ...user, is_admin: user.is_admin === true };
    res.json({ user: userOut, menus: [...new Set(menus)], company, subscription });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/subscription-plans', async (req, res) => {
  try {
    const rows = await db.query(`SELECT id, code, name, description, price_monthly, setup_fee, max_users,
      features_json, limits_json, display_order, is_trial, trial_days, is_recommended, plan_type
      FROM subscription_plans ORDER BY display_order, id`);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/users/me/representative-company', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const { company_id } = req.body;
  const cid = company_id != null && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
  if (!cid) return res.status(400).json({ error: '회사를 선택하세요.' });
  try {
    const belongs = await userBelongsToCompany(req.user.id, cid);
    if (!belongs) return res.status(403).json({ error: '소속 회사만 대표로 설정할 수 있습니다.' });
    await db.run('UPDATE auth_users SET company_id = $1 WHERE id = $2', [cid, req.user.id]);
    res.json({ ok: true, company_id: cid });
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
  let company_id = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
    ? parseInt(req.query.company_id, 10) : null;
  if (company_id == null && req.user?.id) {
    company_id = await getUserRepresentativeCompany(req.user.id);
  }
  try {
    let sql = 'SELECT id, code, name, display_order, company_id FROM account_items';
    const params = [];
    if (company_id != null) {
      sql += ' WHERE company_id = $1';
      params.push(company_id);
    } else {
      return res.json([]);
    }
    sql += ' ORDER BY display_order, id';
    const rows = await db.query(sql, params);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:userName/company', async (req, res) => {
  const userName = req.params.userName?.trim();
  if (!userName) return res.status(400).json({ error: '사용자명 필수' });
  try {
    const row = await db.queryOne(
      `SELECT au.company_id, c.name as company_name FROM auth_users au
       LEFT JOIN companies c ON c.id = au.company_id WHERE au.name = $1`,
      [userName]
    );
    if (!row) return res.json({ company_id: null, company_name: null });
    res.json({ company_id: row.company_id, company_name: row.company_name || null });
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
  let company_id = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
    ? parseInt(req.query.company_id, 10) : null;
  if (company_id == null && req.user?.id) {
    company_id = await getUserRepresentativeCompany(req.user.id);
  }
  try {
    let sql = 'SELECT id, code, name, company_id FROM projects';
    const params = [];
    if (company_id != null) {
      sql += ' WHERE company_id = $1';
      params.push(company_id);
    } else {
      return res.json([]);
    }
    sql += ' ORDER BY name';
    const rows = await db.query(sql, params);
    res.json(rows || []);
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
  const { period_from, period_to, project, card_no, settled, company_id, limit, offset } = req.query;
  try {
    let fromClause = 'FROM expense_documents ed';
    const where = ['ed.status = \'approved\''];
    const params = [];
    const companyIds = (company_id == null || company_id === '') && req.user?.id
      ? await getCurrentUserCompanyIds(req.user.id)
      : null;
    const companyFilter = buildCompanyFilterJoin(company_id, companyIds, params);
    if (companyFilter) { fromClause += companyFilter.join; where.push(companyFilter.whereCond); }
    if (project) { params.push(project); where.push(`ed.project_name = $${params.length}`); }
    if (card_no != null && String(card_no).trim() !== '') {
      params.push(`%${String(card_no).trim()}%`);
      where.push(`(ed.card_no ILIKE $${params.length})`);
    }
    if (period_from) { params.push(period_from); where.push(`ed.period_end >= $${params.length}`); }
    if (period_to) { params.push(period_to); where.push(`ed.period_start <= $${params.length}`); }
    if (settled === 'y' || settled === '1' || settled === 'true') where.push('ed.settled_at IS NOT NULL');
    else if (settled === 'n' || settled === '0' || settled === 'false') where.push('ed.settled_at IS NULL');
    const whereClause = ' WHERE ' + where.join(' AND ');
    const limitVal = limit != null ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    const offsetVal = offset != null ? Math.max(0, parseInt(offset, 10)) : 0;
    const [countRes, rowsRes, sumRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int as total ${fromClause}${whereClause}`, params),
      db.query(`SELECT ed.id, ed.doc_no, ed.user_name, ed.project_name, ed.period_start, ed.period_end, ed.card_no, ed.total_card_amount, ed.total_cash_amount, ed.settled_at
        ${fromClause}${whereClause}
        ORDER BY ed.period_start DESC, ed.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limitVal, offsetVal]),
      db.query(`SELECT COALESCE(SUM(ed.total_card_amount), 0)::bigint as sum_card, COALESCE(SUM(ed.total_cash_amount), 0)::bigint as sum_cash ${fromClause}${whereClause}`, params),
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
  const { status, project, user_name, card_no, period_from, period_to, company_id, limit, offset } = req.query;
  try {
    const where = [];
    const params = [];
    let fromClause = 'FROM expense_documents ed';
    const companyIds = (company_id == null || company_id === '') && req.user?.id
      ? await getCurrentUserCompanyIds(req.user.id)
      : null;
    const companyFilter = buildCompanyFilterJoin(company_id, companyIds, params);
    if (companyFilter) { fromClause += companyFilter.join; where.push(companyFilter.whereCond); }
    if (status) { params.push(status); where.push(`ed.status = $${params.length}`); }
    if (project) { params.push(project); where.push(`ed.project_name = $${params.length}`); }
    if (user_name) { params.push(user_name); where.push(`ed.user_name = $${params.length}`); }
    if (card_no != null && String(card_no).trim() !== '') {
      params.push(`%${String(card_no).trim()}%`);
      where.push(`(ed.card_no ILIKE $${params.length})`);
    }
    if (period_from) { params.push(period_from); where.push(`ed.period_end >= $${params.length}`); }
    if (period_to) { params.push(period_to); where.push(`ed.period_start <= $${params.length}`); }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const baseSql = `SELECT ed.id, ed.doc_no, ed.user_name, ed.project_name, ed.period_start, ed.period_end,
      ed.status, ed.total_card_amount, ed.total_cash_amount, ed.created_at
      ${fromClause}${whereClause}`;
    let rowParams = [...params];
    let pageSql = baseSql + ' ORDER BY ed.created_at DESC';
    if (limit != null) { rowParams.push(parseInt(limit, 10)); pageSql += ` LIMIT $${rowParams.length}`; }
    if (offset != null) { rowParams.push(parseInt(offset, 10)); pageSql += ` OFFSET $${rowParams.length}`; }
    const countSql = `SELECT COUNT(*)::int as total ${fromClause}${whereClause}`;
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
    let companyId = doc.company_id;
    if (!companyId && doc.user_name) {
      try {
        const au = await db.queryOne('SELECT id, company_id FROM auth_users WHERE name = $1 LIMIT 1', [doc.user_name]);
        if (au) {
          companyId = au.company_id;
          if (!companyId) {
            const ids = await getCompanyIdsForUserIncludingSameEmail(au.id);
            if (ids?.length) {
              const defRow = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
              companyId = (defRow && ids.includes(defRow.id)) ? defRow.id : ids[0];
            }
          }
        }
      } catch (_) {}
    }
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
    let hideApprovalContent = false;
    let canApprove = false;
    if (req.user?.id) {
      const u = await db.queryOne('SELECT name, role FROM auth_users WHERE id = $1', [req.user.id]);
      const isAuthor = u?.name && doc.user_name && String(u.name).trim() === String(doc.user_name).trim();
      hideApprovalContent = !!isAuthor;
      if (!isAuthor && doc.status === 'pending' && sequences?.length > 0 && history.length < sequences.length) {
        const nextRole = sequences[history.length]?.role;
        const belongs = companyId ? await userBelongsToCompany(req.user.id, companyId) : false;
        canApprove = !!nextRole && u?.role === nextRole && belongs;
      }
    }
    let approvalNextInfo = null;
    let approvalPendingList = [];
    if (doc.status === 'pending' && sequences?.length > 0 && history.length < sequences.length) {
      const pendingRoles = sequences.slice(history.length);
      for (const seq of pendingRoles) {
        const roleLabel = roleLabelMap[seq.role] || seq.role;
        const approvers = companyId
          ? await db.query(
              `SELECT DISTINCT au.name FROM auth_users au
               WHERE au.role = $1 AND au.is_approved = true
               AND (au.company_id = $2 OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $2))
               ORDER BY au.name`,
              [seq.role, companyId]
            )
          : [];
        approvalPendingList.push({ role: seq.role, roleLabel, names: (approvers || []).map(r => r.name).filter(Boolean) });
      }
      if (approvalPendingList.length) approvalNextInfo = approvalPendingList[0];
    }
    if (doc.status === 'draft' && sequences?.length > 0) {
      for (const seq of sequences) {
        const roleLabel = roleLabelMap[seq.role] || seq.role;
        const approvers = companyId
          ? await db.query(
              `SELECT DISTINCT au.name FROM auth_users au
               WHERE au.role = $1 AND au.is_approved = true
               AND (au.company_id = $2 OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $2))
               ORDER BY au.name`,
              [seq.role, companyId]
            )
          : [];
        approvalPendingList.push({ role: seq.role, roleLabel, names: (approvers || []).map(r => r.name).filter(Boolean) });
      }
    }
    const configured = (sequences || []).length > 0;
    res.json({
      ...doc,
      items,
      approval_steps: steps,
      approval_line: sequences || [],
      hide_approval_content: hideApprovalContent,
      can_approve: canApprove,
      approval_next_info: approvalNextInfo,
      approval_pending_list: approvalPendingList || [],
      approval_sequences_configured: configured,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents', async (req, res) => {
  const { user_name, project_id, project_name, period_start, period_end, card_no, items, company_id } = req.body;
  if (!user_name || !project_name || !period_start || !period_end || !items?.length) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }
  if (!card_no || !String(card_no).trim()) {
    return res.status(400).json({ error: '카드번호를 입력해 주세요.' });
  }
  try {
    let docCompanyId = (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10))) ? parseInt(company_id, 10) : null;
    if (!docCompanyId) {
      const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [user_name]);
      docCompanyId = cu?.company_id;
    }
    if (!docCompanyId) {
      const unnon = await db.queryOne("SELECT id FROM companies WHERE name = '언넌플랫폼' LIMIT 1");
      docCompanyId = unnon?.id || (await db.queryOne('SELECT id FROM companies WHERE is_default = true'))?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    if (!docCompanyId) return res.status(400).json({ error: '회사 정보를 확인할 수 없습니다. 관리자에게 문의하세요.' });
    const docNo = `CARD-${Date.now()}`;
    let totalCard = 0, totalCash = 0;
    items.forEach(i => {
      totalCard += parseInt(i.card_amount || 0, 10);
      totalCash += parseInt(i.cash_amount || 0, 10);
    });
    const r = await db.run(`
      INSERT INTO expense_documents (doc_no, user_name, project_id, project_name, period_start, period_end, card_no, status, total_card_amount, total_cash_amount, company_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10) RETURNING id
    `, [docNo, user_name, project_id || null, project_name, period_start, period_end, card_no || null, totalCard, totalCash, docCompanyId]);
    const docId = r.rows[0].id;
    await db.insertExpenseItems(null, items, docId, project_id || null, project_name);
    res.json({ id: docId, doc_no: docNo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  const { user_name, project_id, project_name, period_start, period_end, card_no, items, company_id } = req.body;
  const id = parseInt(req.params.id, 10);
  if (!id || !items?.length) return res.status(400).json({ error: '필수 항목 누락' });
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await db.queryOne('SELECT status, user_name FROM expense_documents WHERE id = $1', [id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const u = await db.queryOne('SELECT id, name, is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
    let isAdminEdit = false;
    if (doc.status !== 'draft') {
      if (!u || (u.is_admin !== true && u.role !== 'admin')) {
        return res.status(403).json({ error: '작성중 상태에서만 수정 가능합니다. 관리자만 결재대기·승인·반려 문서를 수정할 수 있습니다.' });
      }
      isAdminEdit = true;
    } else {
      const isAuthor = u?.name && doc.user_name && String(u.name).trim() === String(doc.user_name).trim();
      const isAdmin = u && (u.is_admin === true || u.role === 'admin');
      if (!isAuthor && !isAdmin) return res.status(403).json({ error: '본인이 작성한 문서만 수정할 수 있습니다.' });
      if (isAdmin && !isAuthor) isAdminEdit = true;
    }
    let totalCard = 0, totalCash = 0;
    items.forEach(i => {
      totalCard += parseInt(i.card_amount || 0, 10);
      totalCash += parseInt(i.cash_amount || 0, 10);
    });
    let docCompanyId = (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10))) ? parseInt(company_id, 10) : null;
    if (!docCompanyId && user_name) {
      const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [user_name]);
      docCompanyId = cu?.company_id;
    }
    if (!docCompanyId) {
      const unnon = await db.queryOne("SELECT id FROM companies WHERE name = '언넌플랫폼' LIMIT 1");
      docCompanyId = unnon?.id || (await db.queryOne('SELECT id FROM companies WHERE is_default = true'))?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    if (!docCompanyId) return res.status(400).json({ error: '회사 정보를 확인할 수 없습니다.' });
    await db.run(`
      UPDATE expense_documents SET user_name=$1, project_id=$2, project_name=$3, period_start=$4, period_end=$5, card_no=$6,
        total_card_amount=$7, total_cash_amount=$8, company_id=$9, updated_at=now()
      WHERE id=$10
    `, [user_name || '', project_id, project_name || '', period_start || '', period_end || '', card_no || null, totalCard, totalCash, docCompanyId, id]);
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
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await db.queryOne('SELECT id, status, card_no, user_name, company_id FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const u = await db.queryOne('SELECT name FROM auth_users WHERE id = $1', [req.user.id]);
    const isAuthor = u?.name && doc.user_name && String(u.name).trim() === String(doc.user_name).trim();
    if (!isAuthor) return res.status(403).json({ error: '본인이 작성한 문서만 결재 요청할 수 있습니다.' });
    if (doc.status !== 'draft') return res.status(400).json({ error: '작성중 문서만 결재 요청할 수 있습니다.' });
    if (!doc.card_no || !String(doc.card_no).trim()) return res.status(400).json({ error: '카드번호가 없습니다. 문서를 수정해 카드번호를 입력한 후 기안해 주세요.' });
    let companyId = doc.company_id;
    if (!companyId) {
      const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [doc.user_name]);
      companyId = cu?.company_id;
    }
    if (!companyId) {
      const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
      companyId = def?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    const settings = companyId ? await db.queryOne('SELECT auto_approve FROM company_settings WHERE company_id = $1', [companyId]) : null;
    const autoApprove = settings?.auto_approve === true;
    const newStatus = autoApprove ? 'approved' : 'pending';
    const r = await db.run(`UPDATE expense_documents SET status=$1, company_id=COALESCE(company_id,$3), updated_at=now() WHERE id=$2 AND status='draft' RETURNING id`, [newStatus, req.params.id, companyId]);
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
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await db.queryOne('SELECT user_name FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const u = await db.queryOne('SELECT name FROM auth_users WHERE id = $1', [req.user.id]);
    const isAuthor = u?.name && doc.user_name && String(u.name).trim() === String(doc.user_name).trim();
    if (!isAuthor) return res.status(403).json({ error: '본인이 작성한 문서만 기안 취소할 수 있습니다.' });
    const r = await db.run("UPDATE expense_documents SET status='draft', updated_at=now() WHERE id=$1 AND status='pending' RETURNING id", [req.params.id]);
    if (!r.rows?.length) return res.status(400).json({ error: '결재대기 상태에서만 기안 취소할 수 있습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await db.queryOne('SELECT status, user_name FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const u = await db.queryOne('SELECT name FROM auth_users WHERE id = $1', [req.user.id]);
    const isAuthor = u?.name && doc.user_name && String(u.name).trim() === String(doc.user_name).trim();
    if (!isAuthor) return res.status(403).json({ error: '본인이 작성한 문서만 삭제할 수 있습니다.' });
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
    const doc = await db.queryOne('SELECT id, status, user_name, company_id FROM expense_documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'pending') return res.status(400).json({ error: '결재대기 문서만 결재할 수 있습니다.' });
    const u = await db.queryOne('SELECT name, role FROM auth_users WHERE id = $1', [req.user.id]);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const isAuthor = u.name && doc.user_name && String(u.name).trim() === String(doc.user_name).trim();
    if (isAuthor) return res.status(403).json({ error: '작성자는 결재할 수 없습니다.' });
    let companyId = doc.company_id;
    if (!companyId) {
      const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [doc.user_name]);
      companyId = cu?.company_id || (await db.queryOne('SELECT id FROM companies WHERE is_default = true'))?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    const belongs = companyId ? await userBelongsToCompany(req.user.id, companyId) : false;
    if (!belongs) return res.status(403).json({ error: '문서 소속 회사의 결재자만 결재할 수 있습니다.' });
    const sequences = companyId ? await db.query('SELECT role FROM approval_sequences WHERE company_id = $1 ORDER BY sort_order ASC', [companyId]) : [];
    if (!sequences?.length) {
      const companyRow = companyId ? await db.queryOne('SELECT name FROM companies WHERE id = $1', [companyId]) : null;
      const companyName = companyRow?.name || `회사ID ${companyId}`;
      return res.status(403).json({ error: `결재선이 설정되지 않았습니다. 문서 소속( ${companyName} )의 설정 → 결재순서에서 결재선을 추가해 주세요.` });
    }
    const history = await db.query('SELECT sequence FROM approval_history WHERE document_id = $1 ORDER BY sequence ASC', [req.params.id]);
    const nextIdx = history.length;
    if (nextIdx >= sequences.length) return res.status(400).json({ error: '모든 결재가 완료된 문서입니다.' });
    const nextRole = sequences[nextIdx]?.role;
    if (u.role !== nextRole) return res.status(403).json({ error: `현재 결재 권한이 없습니다. (${sequences.map(s => s.role)[nextIdx]} 역할이 결재할 차례입니다.)` });
    const approverName = u.name || '결재자';
    const nextSeq = (history.length ? Math.max(...history.map(h => h.sequence)) : 0) + 1;
    const isLastStep = nextIdx + 1 >= sequences.length;
    const newStatus = action === 'rejected' ? 'rejected' : (action === 'approved' && isLastStep ? 'approved' : 'pending');
    await db.run('UPDATE expense_documents SET status=$1, updated_at=now() WHERE id=$2', [newStatus, req.params.id]);
    await db.run('INSERT INTO approval_history (document_id, approver_name, sequence, action, comment) VALUES ($1, $2, $3, $4, $5)', [req.params.id, approverName, nextSeq, action, comment || null]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/expenses', async (req, res) => {
  const { from, to, project, account_item_id, account_item_name, user_name, description, company_id, limit, offset } = req.query;
  const parsed = require('url').parse(req.url || '', true);
  const status = (parsed.query && parsed.query.status) || req.query.status;
  try {
    const cond = [];
    const params = [];
    let joinClause = 'FROM expense_items ei LEFT JOIN expense_documents ed ON ed.id = ei.document_id';
    const companyIds = (company_id == null || company_id === '') && req.user?.id
      ? await getCurrentUserCompanyIds(req.user.id)
      : null;
    const companyFilter = buildCompanyFilterJoin(company_id, companyIds, params);
    if (companyFilter) { joinClause += companyFilter.join; cond.push(companyFilter.whereCond); }
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
      ${joinClause}
      WHERE ${whereClause}`;
    let rowParams = [...params];
    let pageSql = baseSql + ' ORDER BY ei.use_date DESC, ei.id';
    if (limit != null) { rowParams.push(parseInt(limit, 10)); pageSql += ` LIMIT $${rowParams.length}`; }
    if (offset != null) { rowParams.push(parseInt(offset, 10)); pageSql += ` OFFSET $${rowParams.length}`; }
    const countSql = `SELECT COUNT(*)::int as total ${joinClause} WHERE ${whereClause}`;
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
  const { from, to, project, company_id } = req.query;
  try {
    let joinClause = 'FROM expense_items ei JOIN expense_documents ed ON ed.id = ei.document_id';
    const params = [];
    const companyIds = (company_id == null || company_id === '') && req.user?.id
      ? await getCurrentUserCompanyIds(req.user.id)
      : null;
    const companyFilter = buildCompanyFilterJoin(company_id, companyIds, params);
    if (companyFilter) { joinClause += companyFilter.join; }
    let where = "ed.status IN ('approved','pending')";
    if (companyFilter) where += ` AND ${companyFilter.whereCond}`;
    if (from) { params.push(from); where += ` AND ei.use_date >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND ei.use_date <= $${params.length}`; }
    if (project) { params.push(project); where += ` AND ei.project_name = $${params.length}`; }
    const [byAccount, byProject, byMonth] = await Promise.all([
      db.query(`SELECT ei.account_item_id, ei.account_item_name, SUM(ei.total_amount)::bigint as total
        ${joinClause} WHERE ${where} GROUP BY ei.account_item_id, ei.account_item_name ORDER BY total DESC`, params),
      db.query(`SELECT ei.project_name, SUM(ei.total_amount)::bigint as total
        ${joinClause} WHERE ${where} GROUP BY ei.project_name ORDER BY total DESC`, params),
      db.query(`SELECT to_char(ei.use_date::date, 'YYYY-MM') as month, SUM(ei.total_amount)::bigint as total
        ${joinClause} WHERE ${where} GROUP BY to_char(ei.use_date::date, 'YYYY-MM') ORDER BY month`, params),
    ]);
    res.json({ byAccount, byProject, byMonth });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import/csv', async (req, res) => {
  const { rows, user_name, card_no, project_name: defaultProjectName, company_id } = req.body;
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
    let accountItemsSql = 'SELECT id, name FROM account_items';
    const accountParams = [];
    if (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10))) {
      accountItemsSql += ' WHERE company_id = $1 OR company_id IS NULL';
      accountParams.push(parseInt(company_id, 10));
    }
    const accountItems = await db.query(accountItemsSql, accountParams);
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
    let docCompanyId = (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10))) ? parseInt(company_id, 10) : null;
    if (!docCompanyId && user_name) {
      const cu = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [user_name]);
      docCompanyId = cu?.company_id;
    }
    if (!docCompanyId) {
      const unnon = await db.queryOne("SELECT id FROM companies WHERE name = '언넌플랫폼' LIMIT 1");
      docCompanyId = unnon?.id || (await db.queryOne('SELECT id FROM companies WHERE is_default = true'))?.id || (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    if (!docCompanyId) return res.status(400).json({ error: '회사 정보를 확인할 수 없습니다.' });
    const docNo = `CARD-IMPORT-${Date.now()}`;
    const r = await db.run(`
      INSERT INTO expense_documents (doc_no, user_name, project_name, period_start, period_end, card_no, status, total_card_amount, total_cash_amount, company_id)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9) RETURNING id
    `, [docNo, user_name || 'import', project_name, dates[0], dates[dates.length - 1], card_no || null, totalCard, totalCash, docCompanyId]);
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

/** 역할 한글명 -> 영문 코드 (관리자=admin, 작성자=author 등) */
const ROLE_LABEL_TO_CODE = {
  관리자: 'admin', 작성자: 'author', 검토자: 'reviewer', 승인자: 'approver',
  'ceo': 'ceo', 'CEO': 'ceo',
};
function labelToRoleCode(label) {
  const t = (label || '').trim();
  return ROLE_LABEL_TO_CODE[t] || null;
}

/** 한글명 → 영문 약어 코드 (대문자, 한글은 음절 첫글자, 영문은 단어 첫글자) */
function nameToCodeFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const str = name.trim();
  if (!str) return null;
  const abbrev = [];
  const segments = str.split(/\s+/).filter(Boolean);
  for (const seg of segments) {
    const hasHangul = /[\uAC00-\uD7A3]/.test(seg);
    if (hasHangul) {
      for (let i = 0; i < seg.length; i++) {
        const code = seg.charCodeAt(i);
        if (code >= 0xAC00 && code <= 0xD7A3) {
          const r = hangulRomanization.convert(seg[i]);
          if (r && r[0]) abbrev.push(r[0].toUpperCase());
        } else if (code >= 48 && code <= 57) {
          abbrev.push(seg[i]);
        }
      }
    } else {
      const m = seg.match(/[a-zA-Z0-9]/);
      if (m) abbrev.push(m[0].toUpperCase());
    }
  }
  const s = abbrev.join('').replace(/[^A-Z0-9]/g, '');
  return s || null;
}
function generateEnglishCode(prefix) {
  return `${prefix.toUpperCase()}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

app.post('/api/projects', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const { name, company_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '현장명 필수' });
  try {
    const code = nameToCodeFromName(name.trim()) || generateEnglishCode('prj');
    const cid = company_id != null && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
    if (cid != null) {
      const belongs = await userBelongsToCompany(req.user.id, cid);
      if (!belongs) return res.status(403).json({ error: '소속 회사에만 현장을 추가할 수 있습니다.' });
    }
    const r = await db.run('INSERT INTO projects (code, name, company_id) VALUES ($1, $2, $3) RETURNING id', [code, name.trim(), cid]);
    res.json({ id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/account-items', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const { name, company_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '항목명 필수' });
  try {
    const code = nameToCodeFromName(name.trim()) || generateEnglishCode('item');
    const cid = company_id != null && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
    if (cid != null) {
      const belongs = await userBelongsToCompany(req.user.id, cid);
      if (!belongs) return res.status(403).json({ error: '소속 회사에만 계정과목을 추가할 수 있습니다.' });
    }
    const r = await db.run('INSERT INTO account_items (code, name, company_id) VALUES ($1, $2, $3) RETURNING id', [code, name.trim(), cid]);
    res.json({ id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/account-items/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  if (!name?.trim()) return res.status(400).json({ error: '항목명 필수' });
  try {
    const row = await db.queryOne('SELECT company_id, code FROM account_items WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    if (row.company_id != null) {
      const belongs = await userBelongsToCompany(req.user.id, row.company_id);
      if (!belongs) return res.status(403).json({ error: '소속 회사의 항목만 수정할 수 있습니다.' });
    }
    await db.run('UPDATE account_items SET name=$1 WHERE id=$2', [name.trim(), id]);
    await db.run('UPDATE expense_items SET account_item_name=$1 WHERE account_item_id=$2', [name.trim(), id]);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  if (!name?.trim()) return res.status(400).json({ error: '현장명 필수' });
  try {
    const row = await db.queryOne('SELECT company_id, code FROM projects WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
    if (row.company_id != null) {
      const belongs = await userBelongsToCompany(req.user.id, row.company_id);
      if (!belongs) return res.status(403).json({ error: '소속 회사의 현장만 수정할 수 있습니다.' });
    }
    await db.run('UPDATE projects SET name=$1 WHERE id=$2', [name.trim(), id]);
    await db.run('UPDATE expense_items SET project_name=$1 WHERE project_id=$2', [name.trim(), id]);
    await db.run('UPDATE expense_documents SET project_name=$1 WHERE project_id=$2', [name.trim(), id]);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/account-items/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const row = await db.queryOne('SELECT company_id FROM account_items WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    if (row.company_id != null) {
      const belongs = await userBelongsToCompany(req.user.id, row.company_id);
      if (!belongs) return res.status(403).json({ error: '소속 회사의 항목만 삭제할 수 있습니다.' });
    }
    const used = await db.queryOne('SELECT 1 FROM expense_items WHERE account_item_id = $1 LIMIT 1', [id]);
    if (used) {
      return res.status(400).json({ error: '사용 내역에 등록된 계정과목은 삭제할 수 없습니다.' });
    }
    const r = await db.run('DELETE FROM account_items WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: '다른 회사 문서에서 잘못된 참조가 있습니다. 해당 문서의 계정과목을 해당 회사 계정과목으로 수정한 후 삭제하세요.' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const row = await db.queryOne('SELECT id, company_id FROM projects WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
    if (row.company_id != null) {
      const belongs = await userBelongsToCompany(req.user.id, row.company_id);
      if (!belongs) return res.status(403).json({ error: '소속 회사의 현장만 삭제할 수 있습니다.' });
    }
    const usedInDocs = await db.queryOne('SELECT 1 FROM expense_documents WHERE project_id = $1 LIMIT 1', [id]);
    const usedInItems = await db.queryOne('SELECT 1 FROM expense_items WHERE project_id = $1 LIMIT 1', [id]);
    if (usedInDocs || usedInItems) {
      return res.status(400).json({ error: '사용 내역에 등록된 현장은 삭제할 수 없습니다.' });
    }
    const r = await db.run('DELETE FROM projects WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: '다른 회사 문서에서 잘못된 참조가 있습니다. 해당 문서의 현장을 해당 회사 현장으로 수정한 후 삭제하세요.' });
    res.status(500).json({ error: e.message });
  }
});

// 사용자별 카드 CRUD
app.get('/api/user-cards', async (req, res) => {
  const user_name = req.query.user_name;
  const all = req.query.all === '1' || req.query.all === 'true';
  const company_id = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
    ? parseInt(req.query.company_id, 10)
    : null;
  if (all && req.user && (req.user.is_admin || req.user.role === 'admin')) {
    try {
      if (company_id != null) {
        const rows = await db.query(`
          SELECT uc.id, uc.user_name, uc.card_no, uc.label, uc.is_default
          FROM user_cards uc
          WHERE uc.company_id = $1 OR uc.company_id IS NULL
          ORDER BY uc.user_name, uc.is_default DESC, uc.id
        `, [company_id]);
        return res.json(rows);
      }
      const rows = await db.query('SELECT id, user_name, card_no, label, is_default FROM user_cards ORDER BY user_name, is_default DESC, id');
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (!user_name?.trim()) return res.json([]);
  try {
    let sql = 'SELECT id, user_name, card_no, label, is_default FROM user_cards WHERE user_name = $1';
    const params = [user_name.trim()];
    if (company_id != null) {
      sql += ' AND (company_id = $2 OR company_id IS NULL)';
      params.push(company_id);
    }
    sql += ' ORDER BY is_default DESC, id';
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user-cards', async (req, res) => {
  const { user_name, card_no, label, is_default, company_id } = req.body;
  if (!user_name?.trim() || !card_no?.trim()) return res.status(400).json({ error: '사용자명과 카드번호 필수' });
  try {
    let cid = company_id != null && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
    if (!cid && req.user?.id) {
      const au = await db.queryOne('SELECT company_id FROM auth_users WHERE name = $1 LIMIT 1', [user_name.trim()]);
      cid = au?.company_id ?? null;
    }
    if (!cid) {
      const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
      cid = def?.id ?? null;
    }
    if (is_default) {
      await db.run('UPDATE user_cards SET is_default = false WHERE user_name = $1', [user_name.trim()]);
    }
    const r = await db.run(
      'INSERT INTO user_cards (company_id, user_name, card_no, label, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_name, card_no, label, is_default',
      [cid, user_name.trim(), (card_no || '').trim(), (label || '').trim() || null, !!is_default]
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

// 법인카드 마스터 (회사별)
app.get('/api/corporate-cards', async (req, res) => {
  const company_id = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
    ? parseInt(req.query.company_id, 10)
    : null;
  try {
    let sql = 'SELECT cc.id, cc.company_id, cc.card_no, cc.label, cc.created_at FROM corporate_cards cc';
    const params = [];
    if (company_id != null) {
      sql += ' WHERE cc.company_id = $1';
      params.push(company_id);
    }
    sql += ' ORDER BY cc.company_id, cc.card_no';
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/corporate-cards', async (req, res) => {
  const { company_id, card_no, label } = req.body;
  if (!company_id || isNaN(parseInt(company_id, 10)) || !card_no?.trim()) {
    return res.status(400).json({ error: '회사와 카드번호 필수' });
  }
  const cid = parseInt(company_id, 10);
  try {
    const r = await db.run(
      'INSERT INTO corporate_cards (company_id, card_no, label) VALUES ($1, $2, $3) RETURNING id, company_id, card_no, label, created_at',
      [cid, (card_no || '').trim(), (label || '').trim() || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '동일 회사에 같은 카드번호가 이미 등록되어 있습니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/corporate-cards/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { card_no, label } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const updates = [];
    const params = [];
    let idx = 1;
    if (card_no !== undefined) { params.push((card_no || '').trim()); updates.push(`card_no = $${idx++}`); }
    if (label !== undefined) { params.push((label || '').trim() || null); updates.push(`label = $${idx++}`); }
    if (updates.length === 0) return res.status(400).json({ error: '수정할 필드 없음' });
    params.push(id);
    await db.run(
      `UPDATE corporate_cards SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );
    const row = await db.queryOne('SELECT id, company_id, card_no, label, created_at FROM corporate_cards WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '법인카드를 찾을 수 없습니다.' });
    res.json(row);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '동일 회사에 같은 카드번호가 이미 등록되어 있습니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/corporate-cards/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const r = await db.run('DELETE FROM corporate_cards WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '법인카드를 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 슈퍼관리자용 마스터 템플릿 (신규 회사 생성 시 마이그레이션용)
app.get('/api/admin/master-templates/account-items', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  try {
    const rows = await db.query('SELECT id, code, name, display_order FROM master_templates_account_items ORDER BY display_order, id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/admin/master-templates/projects', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  try {
    const rows = await db.query('SELECT id, code, name FROM master_templates_projects ORDER BY name');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/admin/master-templates/account-items', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '항목명 필수' });
  try {
    const code = nameToCodeFromName(name.trim()) || generateEnglishCode('acct');
    const r = await db.run(
      'INSERT INTO master_templates_account_items (code, name, display_order) VALUES ($1, $2, 99) RETURNING id, code, name, display_order',
      [code, name.trim()]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/admin/master-templates/account-items/:id', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!id || isNaN(id) || !name?.trim()) return res.status(400).json({ error: 'ID 및 항목명 필수' });
  try {
    const code = nameToCodeFromName(name.trim()) || generateEnglishCode('acct');
    await db.run('UPDATE master_templates_account_items SET code=$1, name=$2 WHERE id=$3', [code, name.trim(), id]);
    const row = await db.queryOne('SELECT id, code, name FROM master_templates_account_items WHERE id = $1', [id]);
    res.json(row || { id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/admin/master-templates/account-items/:id', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const r = await db.run('DELETE FROM master_templates_account_items WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/admin/master-templates/projects', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '현장명 필수' });
  try {
    const code = nameToCodeFromName(name.trim()) || generateEnglishCode('prj');
    const r = await db.run(
      'INSERT INTO master_templates_projects (code, name) VALUES ($1, $2) RETURNING id, code, name',
      [code, name.trim()]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/admin/master-templates/projects/:id', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!id || isNaN(id) || !name?.trim()) return res.status(400).json({ error: 'ID 및 현장명 필수' });
  try {
    const code = nameToCodeFromName(name.trim()) || generateEnglishCode('prj');
    await db.run('UPDATE master_templates_projects SET code=$1, name=$2 WHERE id=$3', [code, name.trim(), id]);
    const row = await db.queryOne('SELECT id, code, name FROM master_templates_projects WHERE id = $1', [id]);
    res.json(row || { id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/admin/master-templates/projects/:id', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const u = await db.queryOne('SELECT is_admin, role FROM auth_users WHERE id = $1', [req.user.id]);
  if (!u || (u.is_admin !== true && u.role !== 'admin')) return res.status(403).json({ error: '관리자 권한 필요' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const r = await db.run('DELETE FROM master_templates_projects WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
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

/** 동일 이메일의 모든 auth_users 소속 회사 ID 조회 (이메일 회사별 허용 시 1인 다회사 지원) */
async function getCompanyIdsForUserIncludingSameEmail(userId) {
  if (!userId) return [];
  const rows = await db.query(
    `SELECT company_id FROM auth_user_companies
     WHERE user_id IN (SELECT id FROM auth_users WHERE LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM auth_users WHERE id = $1 LIMIT 1))
     UNION
     SELECT company_id FROM auth_users
     WHERE LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM auth_users WHERE id = $1 LIMIT 1) AND company_id IS NOT NULL`,
    [userId]
  );
  return [...new Set((rows || []).map(r => r.company_id).filter(Boolean))];
}

/** 모든 사용자: 소속 회사만 조회 (동일 이메일 다회사 계정 포함). 슈퍼관리자는 전체 회사 반환 */
async function getCompaniesForUser(user) {
  if (!user?.id) return [];
  if (user?.is_admin === true) {
    return db.query('SELECT id, name, is_default FROM companies ORDER BY is_default DESC, id');
  }
  const ids = await getCompanyIdsForUserIncludingSameEmail(user.id);
  if (ids.length === 0) return [];
  return db.query(
    `SELECT c.id, c.name, c.is_default FROM companies c WHERE c.id = ANY($1::int[]) ORDER BY c.id`,
    [ids]
  );
}

/** 자신이 속한 회사만 조회 (슈퍼관리자 포함) */
async function getCompaniesForUserMine(user) {
  if (!user?.id) return [];
  const ids = await getCompanyIdsForUserIncludingSameEmail(user.id);
  if (ids.length === 0) return [];
  return db.query(
    `SELECT c.id, c.name, c.is_default FROM companies c WHERE c.id = ANY($1::int[]) ORDER BY c.is_default DESC, c.id`,
    [ids]
  );
}

/** 사용자 소속 회사 여부 (동일 이메일 다회사 계정 포함) */
async function userBelongsToCompany(userId, companyId) {
  if (!userId || !companyId) return false;
  const ids = await getCompanyIdsForUserIncludingSameEmail(userId);
  return ids.includes(parseInt(companyId, 10));
}

/** 현재 사용자 소속 회사 ID 배열 (동일 이메일 다회사 계정 포함) */
async function getCurrentUserCompanyIds(userId) {
  return getCompanyIdsForUserIncludingSameEmail(userId);
}

/** document/expense 조회 시 회사 필터: { join, whereCond } (ed.company_id 우선, 없으면 auth_users 기준) */
function buildCompanyFilterJoin(companyId, companyIds, params) {
  if (companyId != null && companyId !== '' && !isNaN(parseInt(companyId, 10))) {
    params.push(parseInt(companyId, 10));
    const p = params.length;
    return {
      join: ' LEFT JOIN auth_users au ON au.name = ed.user_name',
      whereCond: `(ed.company_id = $${p} OR (ed.company_id IS NULL AND (au.company_id = $${p} OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $${p}))))`,
    };
  }
  if (companyIds && companyIds.length > 0) {
    params.push(companyIds);
    const p = params.length;
    return {
      join: ' LEFT JOIN auth_users au ON au.name = ed.user_name',
      whereCond: `(ed.company_id = ANY($${p}::int[]) OR (ed.company_id IS NULL AND (au.company_id = ANY($${p}::int[]) OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = ANY($${p}::int[])))))`,
    };
  }
  return null;
}

/** 사용자 대표회사 (top/bottom 연동용): auth_users.company_id 또는 소속 첫 회사 (동일 이메일 다회사 포함) */
async function getUserRepresentativeCompany(userId) {
  if (!userId) return null;
  const user = await db.queryOne('SELECT company_id FROM auth_users WHERE id = $1', [userId]);
  const repId = user?.company_id;
  const ids = await getCompanyIdsForUserIncludingSameEmail(userId);
  if (repId && ids.includes(repId)) return repId;
  return ids[0] || null;
}

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
  const { label, company_id } = req.body || {};
  if (!label?.trim()) return res.status(400).json({ error: '역할 이름을 입력하세요.' });
  let cid = company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
  if (!cid && req.user?.id) {
    cid = await getUserRepresentativeCompany(req.user.id);
  }
  if (!cid) {
    const def = await db.queryOne('SELECT id FROM companies ORDER BY (CASE WHEN is_default THEN 0 ELSE 1 END), id LIMIT 1');
    cid = def?.id || null;
  }
  if (!cid) return res.status(400).json({ error: '회사를 선택한 후 역할을 추가하세요.' });
  const isSuperAdmin = req.user?.is_admin === true;
  if (!isSuperAdmin) {
    const belongs = await userBelongsToCompany(req.user.id, cid);
    if (!belongs) return res.status(403).json({ error: '소속 회사에만 역할을 추가할 수 있습니다.' });
  }
  const c = labelToRoleCode(label) || nameToCodeFromName(label.trim()) || `role_${Date.now()}`;
  try {
    const r = await db.run('INSERT INTO roles (company_id, code, label, display_order) VALUES ($1, $2, $3, 99) RETURNING id, code, label, display_order', [cid, c, label.trim()]);
    const row = r.rows[0];
    if (!row) return res.status(500).json({ error: '역할 등록에 실패했습니다.' });
    res.json(row);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '해당 회사에 이미 존재하는 역할 코드입니다.' });
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
    const row = await db.queryOne('SELECT code, company_id FROM roles WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '역할을 찾을 수 없습니다.' });
    if (row.company_id) {
      const belongs = await userBelongsToCompany(req.user.id, row.company_id);
      if (!belongs) return res.status(403).json({ error: '해당 회사의 역할만 삭제할 수 있습니다.' });
    }
    if (row.code === 'admin') return res.status(400).json({ error: '관리자 역할은 삭제할 수 없습니다.' });
    const users = row.company_id
      ? await db.query(`SELECT 1 FROM auth_users au WHERE au.role = $1 AND (au.company_id = $2 OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $2)) LIMIT 1`, [row.code, row.company_id])
      : await db.query('SELECT id FROM auth_users WHERE role = $1 LIMIT 1', [row.code]);
    if (users.length > 0) return res.status(400).json({ error: `해당 역할을 가진 사용자가 ${users.length}명 있어 삭제할 수 없습니다.` });
    if (row.company_id) {
      await db.run('DELETE FROM role_menus WHERE company_id = $1 AND role = $2', [row.company_id, row.code]);
    } else {
      await db.run('DELETE FROM role_menus WHERE role = $1', [row.code]);
    }
    await db.run('DELETE FROM roles WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/companies', requireAdmin, async (req, res) => {
  try {
    const withSettings = req.query.with_settings === '1' || req.query.with_settings === 'true';
    const companyIds = await getCompanyIdsForUserIncludingSameEmail(req.user.id);
    if (companyIds.length === 0) {
      const result = withSettings ? { companies: [], auto_approve: false } : [];
      return res.json(result);
    }
    const companySql = `
      SELECT c.id, c.name, c.logo_url, c.address, c.ceo_name, c.founded_date, c.business_reg_no, c.tel, c.fax, c.email, c.copyright_text, c.is_default
      FROM companies c
      WHERE c.id = ANY($1::int[])
      ORDER BY c.id
    `;
    const rows = await db.query(companySql, [companyIds]);
    const firstCompanyId = rows?.[0]?.id;
    const settingsRow = withSettings && firstCompanyId
      ? await db.queryOne('SELECT auto_approve FROM company_settings WHERE company_id = $1 LIMIT 1', [firstCompanyId])
      : null;
    if (withSettings) {
      res.json({ companies: rows, auto_approve: settingsRow?.auto_approve ?? false });
    } else {
      res.json(rows);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 슈퍼관리자 전용: 회사 + 관리자 사용자 일괄 등록 */
app.post('/api/admin/super/company-with-admin', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '슈퍼관리자만 가능합니다.' });
  const { name: companyName, email, userName, password } = req.body;
  if (!companyName?.trim()) return res.status(400).json({ error: '회사명을 입력하세요.' });
  if (!email?.trim()) return res.status(400).json({ error: '관리자 이메일을 입력하세요.' });
  const pw = password && String(password).length >= 4 ? password : null;
  if (!pw) return res.status(400).json({ error: '관리자 비밀번호를 4자 이상 입력하세요.' });
  try {
    const companyNameTrim = companyName.trim();
    const existingCompany = await db.queryOne('SELECT id FROM companies WHERE TRIM(name) = $1', [companyNameTrim]);
    if (existingCompany) return res.status(400).json({ error: '이미 등록된 회사명입니다. 다른 회사명을 사용하세요.' });

    const rows = await db.query('SELECT id FROM companies');
    const isFirst = rows.length === 0;
    const cr = await db.run(
      `INSERT INTO companies (name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default)
       VALUES ($1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, $2) RETURNING id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default, created_at`,
      [companyNameTrim, isFirst]
    );
    const newCompanyId = cr.rows[0].id;
    const [tplAccounts, tplProjects] = await Promise.all([
      db.query('SELECT code, name, display_order FROM master_templates_account_items ORDER BY display_order, id'),
      db.query('SELECT code, name FROM master_templates_projects ORDER BY id'),
    ]);
    if (tplAccounts?.length) {
      for (const t of tplAccounts) {
        await db.run(
          'INSERT INTO account_items (company_id, code, name, display_order) VALUES ($1, $2, $3, $4)',
          [newCompanyId, t.code, t.name, t.display_order ?? 0]
        );
      }
    }
    if (tplProjects?.length) {
      for (const t of tplProjects) {
        await db.run(
          'INSERT INTO projects (company_id, code, name) VALUES ($1, $2, $3)',
          [newCompanyId, t.code || null, t.name]
        );
      }
    }
    const hash = await auth.hashPassword(pw);
    const ur = await db.run(
      `INSERT INTO auth_users (company_id, email, password_hash, name, role, is_admin, is_approved)
       VALUES ($1, $2, $3, $4, 'admin', false, true) RETURNING id, email, name, role`,
      [newCompanyId, email.trim(), hash, (userName || '').trim() || (email || '').split('@')[0]]
    );
    await db.run('INSERT INTO auth_user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT (user_id, company_id) DO NOTHING', [ur.rows[0].id, newCompanyId]);
    const srcRoles = await db.query('SELECT code, label, display_order FROM roles WHERE company_id IS NOT NULL ORDER BY company_id, display_order LIMIT 20');
    const rolesToCopy = (srcRoles && srcRoles.length) ? srcRoles : [
      { code: 'admin', label: '관리자', display_order: 0 }, { code: 'author', label: '작성자', display_order: 1 },
      { code: 'reviewer', label: '검토자', display_order: 2 }, { code: 'approver', label: '승인자', display_order: 3 }, { code: 'ceo', label: 'CEO', display_order: 4 }
    ];
    const seen = new Set();
    for (const r of rolesToCopy) {
      if (seen.has(r.code)) continue;
      seen.add(r.code);
      await db.run('INSERT INTO roles (company_id, code, label, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT (company_id, code) DO NOTHING', [newCompanyId, r.code, r.label, r.display_order ?? 99]);
    }
    res.json({ company: cr.rows[0], user: ur.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 등록된 회사명이거나 동일 회사에 이미 등록된 이메일입니다.' });
    res.status(500).json({ error: e.message });
  }
});

/** 슈퍼관리자 전용: 회사 목록 (페이징, 전체 필드, 조회조건) */
app.get('/api/admin/super/companies-page', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '슈퍼관리자만 가능합니다.' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  const ceo_name = typeof req.query.ceo_name === 'string' ? req.query.ceo_name.trim() : '';
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  try {
    const cond = [];
    const params = [];
    let pIdx = 1;
    if (name) {
      params.push(`%${name}%`);
      cond.push(`name ILIKE $${pIdx++}`);
    }
    if (ceo_name) {
      params.push(`%${ceo_name}%`);
      cond.push(`ceo_name ILIKE $${pIdx++}`);
    }
    if (email) {
      params.push(`%${email}%`);
      cond.push(`email ILIKE $${pIdx++}`);
    }
    const whereClause = cond.length ? ' WHERE ' + cond.join(' AND ') : '';
    const countRes = await db.queryOne(
      `SELECT COUNT(*)::int as total FROM companies${whereClause}`,
      params
    );
    const total = countRes?.total ?? 0;
    params.push(limit, offset);
    const rows = await db.query(
      `SELECT id, name, logo_url, address, ceo_name, founded_date, business_reg_no, tel, fax, email, copyright_text, is_default, created_at
       FROM companies${whereClause} ORDER BY is_default DESC, id LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );
    res.json({ rows: rows || [], total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/companies', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '회사 추가는 슈퍼관리자만 가능합니다.' });
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
    const newCompanyId = r.rows[0].id;
    const [tplAccounts, tplProjects] = await Promise.all([
      db.query('SELECT code, name, display_order FROM master_templates_account_items ORDER BY display_order, id'),
      db.query('SELECT code, name FROM master_templates_projects ORDER BY id'),
    ]);
    if (tplAccounts?.length) {
      for (const t of tplAccounts) {
        await db.run(
          'INSERT INTO account_items (company_id, code, name, display_order) VALUES ($1, $2, $3, $4)',
          [newCompanyId, t.code, t.name, t.display_order ?? 0]
        );
      }
    }
    if (tplProjects?.length) {
      for (const t of tplProjects) {
        await db.run(
          'INSERT INTO projects (company_id, code, name) VALUES ($1, $2, $3)',
          [newCompanyId, t.code || null, t.name]
        );
      }
    }
    const defaultRoles = [
      { code: 'admin', label: '관리자', display_order: 0 },
      { code: 'author', label: '작성자', display_order: 1 },
    ];
    for (const role of defaultRoles) {
      await db.run('INSERT INTO roles (company_id, code, label, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT (company_id, code) DO NOTHING', [newCompanyId, role.code, role.label, role.display_order]);
    }
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/companies/:id/set-default', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '대표 회사 설정은 슈퍼관리자만 가능합니다.' });
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
    const belongs = await userBelongsToCompany(req.user.id, id);
    if (!belongs) return res.status(403).json({ error: '소속 회사만 수정할 수 있습니다.' });
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
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '회사 삭제는 슈퍼관리자만 가능합니다.' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const users = await db.query('SELECT id FROM auth_users WHERE company_id = $1', [id]);
    if (users.length > 0) return res.status(400).json({ error: `해당 회사 소속 사용자 ${users.length}명이 있어 삭제할 수 없습니다.` });
    const auc = await db.query('SELECT 1 FROM auth_user_companies WHERE company_id = $1 LIMIT 1', [id]);
    if (auc.length > 0) return res.status(400).json({ error: '해당 회사에 소속된 사용자가 있어 삭제할 수 없습니다. 먼저 사용자-회사 연결을 해제하세요.' });
    const def = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
    if (def?.id === id) return res.status(400).json({ error: '대표 회사는 삭제할 수 없습니다. 다른 회사를 대표로 설정 후 삭제하세요.' });

    const projIds = (await db.query('SELECT id FROM projects WHERE company_id = $1', [id])).map((r) => r.id);
    if (projIds.length > 0) {
      const placeholders = projIds.map((_, i) => `$${i + 1}`).join(',');
      await db.run(`DELETE FROM admin_edit_history WHERE document_id IN (SELECT id FROM expense_documents WHERE project_id IN (${placeholders}))`, projIds);
      await db.run(`DELETE FROM approval_history WHERE document_id IN (SELECT id FROM expense_documents WHERE project_id IN (${placeholders}))`, projIds);
      await db.run(`DELETE FROM expense_documents WHERE project_id IN (${placeholders})`, projIds);
      await db.run(`UPDATE user_settings SET default_project_id = NULL WHERE default_project_id IN (${placeholders})`, projIds);
      await db.run(`UPDATE auth_users SET project_id = NULL WHERE project_id IN (${placeholders})`, projIds);
    }
    await db.run('DELETE FROM role_menus WHERE company_id = $1', [id]);
    await db.run('DELETE FROM auth_user_companies WHERE company_id = $1', [id]);
    await db.run('DELETE FROM approval_sequences WHERE company_id = $1', [id]);
    await db.run('DELETE FROM company_settings WHERE company_id = $1', [id]);
    await db.run('DELETE FROM corporate_cards WHERE company_id = $1', [id]);
    await db.run('DELETE FROM user_cards WHERE company_id = $1', [id]);
    await db.run('DELETE FROM account_mapping_rules WHERE account_item_id IN (SELECT id FROM account_items WHERE company_id = $1)', [id]);
    await db.run('DELETE FROM account_items WHERE company_id = $1', [id]);
    await db.run('DELETE FROM projects WHERE company_id = $1', [id]);
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
      conditions.push(`(au.company_id = $${idx} OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $${idx}))`);
      idx++;
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
  if (!email?.trim()) return res.status(400).json({ error: '이메일 필수' });
  const cid = (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10)))
    ? parseInt(company_id, 10) : null;
  try {
    const em = String(email || '').trim();
    const existing = await db.queryOne('SELECT id, company_id FROM auth_users WHERE LOWER(TRIM(email)) = LOWER($1)', [em]);
    if (existing) {
      if (!cid) return res.status(400).json({ error: '이미 등록된 이메일입니다. 다른 회사에 추가하려면 회사를 선택하세요.' });
      const hasMain = (existing.company_id != null && parseInt(existing.company_id, 10) === cid);
      const hasAuc = await db.queryOne('SELECT 1 FROM auth_user_companies WHERE user_id = $1 AND company_id = $2', [existing.id, cid]);
      if (hasMain || hasAuc) return res.status(400).json({ error: '해당 회사에 이미 등록된 이메일입니다.' });
      await db.run('INSERT INTO auth_user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT (user_id, company_id) DO NOTHING', [existing.id, cid]);
      const row = await db.queryOne('SELECT au.id, au.email, au.name, au.role FROM auth_users au WHERE au.id = $1', [existing.id]);
      return res.json(row);
    }
    if (!password) return res.status(400).json({ error: '신규 등록 시 비밀번호 필수' });
    const hash = await auth.hashPassword(password);
    const newRole = role || 'author';
    const isAdminRole = newRole === 'admin';
    const r = await db.run(
      `INSERT INTO auth_users (company_id, project_id, email, password_hash, name, role, is_admin, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, name, role`,
      [cid, project_id ? parseInt(project_id, 10) : null, email.trim(), hash, (name || '').trim() || email.split('@')[0], newRole, isAdminRole, !!is_approved]
    );
    if (cid) {
      await db.run('INSERT INTO auth_user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT (user_id, company_id) DO NOTHING', [r.rows[0].id, cid]);
    }
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 등록된 이메일입니다. 다른 회사에 추가하려면 회사를 선택한 후 추가하세요.' });
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

/** 해당 회사의 역할만 반환 */
app.get('/api/admin/roles-by-company', requireAdmin, async (req, res) => {
  try {
    const cid = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
      ? parseInt(req.query.company_id, 10) : null;
    if (!cid) return res.json([]);
    const rows = await db.query('SELECT id, code, label, display_order FROM roles WHERE company_id = $1 ORDER BY display_order, id', [cid]);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/role-menus', requireAdmin, async (req, res) => {
  try {
    const cid = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
      ? parseInt(req.query.company_id, 10) : null;
    if (!cid) return res.status(400).json({ error: '회사 선택 필수' });
    const rows = await db.query('SELECT role, menu_path FROM role_menus WHERE company_id = $1 ORDER BY role, menu_path', [cid]);
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
  const { role, menus, company_id } = req.body;
  if (!role) return res.status(400).json({ error: 'role 필수' });
  const cid = company_id != null && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
  if (!cid) return res.status(400).json({ error: '회사 선택 필수' });
  if (role === 'company_admin') {
    const u = await db.queryOne('SELECT is_admin FROM auth_users WHERE id = $1', [req.user?.id]);
    if (!u?.is_admin) return res.status(403).json({ error: '회사별 관리자 메뉴는 슈퍼관리자만 수정할 수 있습니다.' });
  }
  try {
    await db.run('DELETE FROM role_menus WHERE company_id = $1 AND role = $2', [cid, role]);
    for (const m of (menus || [])) {
      if (m?.trim()) await db.run('INSERT INTO role_menus (company_id, role, menu_path) VALUES ($1, $2, $3)', [cid, role, m.trim()]);
    }
    const rows = await db.query('SELECT menu_path FROM role_menus WHERE company_id = $1 AND role = $2', [cid, role]);
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
    const companyIdParam = req.query.company_id != null && req.query.company_id !== ''
      ? parseInt(req.query.company_id, 10)
      : null;
    const cidParam = companyIdParam || null;
    const [seqRows, companies, defaultCompany, rolesData] = await Promise.all([
      db.query('SELECT id, company_id, role, sort_order FROM approval_sequences ORDER BY company_id, sort_order'),
      getCompaniesForUserMine(req.user),
      db.queryOne('SELECT id, name, logo_url FROM companies WHERE is_default = true')
        .then(r => r || db.queryOne('SELECT id, name, logo_url FROM companies ORDER BY id LIMIT 1')),
      cidParam
        ? db.query('SELECT DISTINCT r.id, r.code, r.label, r.display_order FROM roles r INNER JOIN role_menus rm ON rm.role = r.code AND rm.company_id = $1 ORDER BY r.display_order, r.id', [cidParam])
        : db.query('SELECT id, code, label, display_order FROM roles ORDER BY display_order, id')
    ]);
    const cid = cidParam || defaultCompany?.id || (companies[0]?.id);
    const companyRow = cid ? await db.queryOne('SELECT id, name, logo_url FROM companies WHERE id = $1', [cid]) : null;
    const sequences = (seqRows || []).filter(r => r.company_id === cid);
    const settingsRow = cid ? await db.queryOne('SELECT auto_approve FROM company_settings WHERE company_id = $1', [cid]) : null;
    res.json({
      sequences: sequences.length ? sequences : [],
      company: companyRow,
      companies: companies || [],
      roles: rolesData || [],
      auto_approve: settingsRow?.auto_approve ?? false,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/batch/role-permissions', requireAdmin, async (req, res) => {
  try {
    const cid = req.query.company_id != null && req.query.company_id !== '' && !isNaN(parseInt(req.query.company_id, 10))
      ? parseInt(req.query.company_id, 10) : null;
    // 역할은 회사별 조회 (회사 선택 시에만)
    const rolesSql = cid
      ? 'SELECT id, code, label, display_order FROM roles WHERE company_id = $1 ORDER BY display_order, id'
      : 'SELECT id, code, label, display_order FROM roles WHERE 1=0';
    const rolesParams = cid ? [cid] : [];
    const [rolesData, menuRows, companiesData] = await Promise.all([
      db.query(rolesSql, rolesParams),
      cid ? db.query('SELECT role, menu_path FROM role_menus WHERE company_id = $1 ORDER BY role, menu_path', [cid]) : [],
      getCompaniesForUserMine(req.user)
    ]);
    const byRole = {};
    (menuRows || []).forEach(r => {
      if (!byRole[r.role]) byRole[r.role] = [];
      byRole[r.role].push(r.menu_path);
    });
    res.json({ roles: rolesData || [], roleMenus: byRole, companies: companiesData || [] });
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
    if (company_id != null && company_id !== '') {
      const cid = parseInt(company_id, 10);
      if (isNaN(cid)) return res.status(400).json({ error: '유효하지 않은 회사 ID' });
      params.push(cid);
      conditions.push(`uc.company_id = $${idx++}`);
    } else {
      // 회사 전체: 자신이 속한 회사만 조회
      const myCompanyIds = await getCompanyIdsForUserIncludingSameEmail(req.user.id);
      if (myCompanyIds.length === 0) {
        conditions.push(`1 = 0`);
      } else {
        params.push(myCompanyIds);
        conditions.push(`uc.company_id = ANY($${idx++}::int[])`);
      }
    }
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
    const roleMenusCid = (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10)))
      ? parseInt(company_id, 10) : null;
    const filterCid = roleMenusCid;

    const usersParams = [...params, limitVal, offsetVal];
    const projectsQuery = filterCid
      ? db.query('SELECT id, name FROM projects WHERE company_id = $1 OR company_id IS NULL ORDER BY name', [filterCid])
      : Promise.resolve([]);
    const rolesQuery = filterCid
      ? db.query('SELECT id, code, label, display_order FROM roles WHERE company_id = $1 ORDER BY display_order, id', [filterCid])
      : Promise.resolve([]);

    const [usersRes, rolesData, menuRows, projectsData, companiesData] = await Promise.all([
      db.query(`
        WITH user_companies AS (
          SELECT user_id, company_id FROM auth_user_companies
          UNION
          SELECT id as user_id, company_id FROM auth_users WHERE company_id IS NOT NULL
        )
        SELECT au.id, au.email, au.name, au.role, au.is_admin, au.is_approved, au.company_id, au.project_id, au.created_at,
               p.name as project_name, uc.company_id as row_company_id, c.name as row_company_name,
               COUNT(*) OVER ()::int as total
        FROM auth_users au
        JOIN user_companies uc ON uc.user_id = au.id
        JOIN companies c ON c.id = uc.company_id
        LEFT JOIN projects p ON p.id = au.project_id
        ${where}
        ORDER BY au.is_approved ASC, c.name, au.email
        LIMIT $${idx} OFFSET $${idx + 1}
      `, usersParams),
      rolesQuery,
      roleMenusCid
        ? db.query('SELECT role, menu_path FROM role_menus WHERE company_id = $1 ORDER BY role, menu_path', [roleMenusCid])
        : db.query('SELECT role, menu_path FROM role_menus WHERE company_id = (SELECT id FROM companies WHERE is_default = true LIMIT 1) ORDER BY role, menu_path'),
      projectsQuery,
      getCompaniesForUserMine(req.user)
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
  const { limit, offset, company_id } = req.query;
  const lim = limit != null ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
  const off = offset != null ? Math.max(0, parseInt(offset, 10)) : 0;
  try {
    let joinClause = 'FROM admin_edit_history aeh JOIN expense_documents ed ON ed.id = aeh.document_id';
    const params = [];
    if (company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10))) {
      params.push(parseInt(company_id, 10));
      joinClause += ` JOIN auth_users au ON au.name = ed.user_name AND (au.company_id = $1 OR EXISTS (SELECT 1 FROM auth_user_companies auc WHERE auc.user_id = au.id AND auc.company_id = $1))`;
    }
    params.push(lim, off);
    const rowsRes = await db.query(`
      SELECT aeh.id, aeh.document_id, aeh.admin_name, aeh.document_status, aeh.created_at,
             ed.doc_no, ed.user_name, ed.project_name, ed.period_start, ed.period_end,
             COUNT(*) OVER ()::int as total
      ${joinClause}
      ORDER BY aeh.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
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
  const cid = company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10))
    ? parseInt(company_id, 10)
    : (await db.queryOne('SELECT id FROM companies ORDER BY is_default DESC, id LIMIT 1'))?.id;
  if (!cid) return res.status(400).json({ error: '회사 정보가 없습니다.' });
  const val = !!auto_approve;
  try {
    const updated = await db.run('UPDATE company_settings SET auto_approve = $2 WHERE company_id = $1', [cid, val]);
    if (updated.rowCount === 0) {
      await db.run('INSERT INTO company_settings (company_id, auto_approve) VALUES ($1, $2)', [cid, val]);
    }
    res.json({ auto_approve: val });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 요금제 관리 (슈퍼관리자 전용)
app.post('/api/admin/subscription-plans', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '슈퍼관리자만 요금제를 등록할 수 있습니다.' });
  const { code, name, description, price_monthly, setup_fee, max_users, features_json, limits_json, display_order, is_trial, trial_days, is_recommended, plan_type } = req.body;
  if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: '코드와 이름은 필수입니다.' });
  try {
    const r = await db.run(
      `INSERT INTO subscription_plans (code, name, description, price_monthly, setup_fee, max_users, features_json, limits_json, display_order, is_trial, trial_days, is_recommended, plan_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [code.trim(), name.trim(), description?.trim() || null, parseInt(price_monthly, 10) || 0, parseInt(setup_fee, 10) || 0,
        parseInt(max_users, 10) || 10, JSON.stringify(features_json || []), JSON.stringify(limits_json || {}),
        parseInt(display_order, 10) || 99, !!is_trial, is_trial ? (parseInt(trial_days, 10) || 14) : null,
        !!is_recommended, (plan_type === 'unlimited' ? 'unlimited' : 'basic')]
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 존재하는 코드입니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/subscription-plans/:id', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '슈퍼관리자만 요금제를 수정할 수 있습니다.' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  const { code, name, description, price_monthly, setup_fee, max_users, features_json, limits_json, display_order, is_trial, trial_days, is_recommended, plan_type } = req.body;
  try {
    const row = await db.queryOne('SELECT * FROM subscription_plans WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: '요금제를 찾을 수 없습니다.' });
    const c = code?.trim() ?? row.code;
    const n = name?.trim() ?? row.name;
    const desc = description !== undefined ? (description?.trim() || null) : row.description;
    const pm = price_monthly !== undefined ? (parseInt(price_monthly, 10) || 0) : row.price_monthly;
    const sf = setup_fee !== undefined ? (parseInt(setup_fee, 10) || 0) : (row.setup_fee ?? 0);
    const mu = max_users !== undefined ? (parseInt(max_users, 10) || 10) : row.max_users;
    const fj = features_json !== undefined ? JSON.stringify(Array.isArray(features_json) ? features_json : []) : JSON.stringify(row.features_json || []);
    const lj = limits_json !== undefined ? JSON.stringify(typeof limits_json === 'object' ? limits_json : {}) : JSON.stringify(row.limits_json || {});
    const do_ = display_order !== undefined ? parseInt(display_order, 10) : (row.display_order ?? 99);
    const it = is_trial !== undefined ? !!is_trial : row.is_trial;
    const td = is_trial ? (parseInt(trial_days, 10) || 14) : null;
    const ir = is_recommended !== undefined ? !!is_recommended : (row.is_recommended ?? false);
    const pt = plan_type === 'unlimited' ? 'unlimited' : 'basic';
    await db.run(
      `UPDATE subscription_plans SET code=$2, name=$3, description=$4, price_monthly=$5, setup_fee=$6, max_users=$7,
       features_json=$8, limits_json=$9, display_order=$10, is_trial=$11, trial_days=$12, is_recommended=$13, plan_type=$14 WHERE id=$1`,
      [id, c, n, desc, pm, sf, mu, fj, lj, do_, it, td, ir, pt]
    );
    const updated = await db.queryOne('SELECT * FROM subscription_plans WHERE id = $1', [id]);
    res.json(updated);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '이미 존재하는 코드입니다.' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/subscription-plans/:id', requireAdmin, async (req, res) => {
  if (req.user?.is_admin !== true) return res.status(403).json({ error: '슈퍼관리자만 요금제를 삭제할 수 있습니다.' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID 필수' });
  try {
    const used = await db.queryOne('SELECT 1 FROM company_subscriptions WHERE plan_id = $1 LIMIT 1', [id]);
    if (used) return res.status(400).json({ error: '사용 중인 요금제는 삭제할 수 없습니다.' });
    await db.run('DELETE FROM subscription_plans WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/batch-approval-excel', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { period_from, period_to, status, project, card_no, company_id, output_mode } = req.query;
  const mode = (output_mode === 'by_item') ? 'by_item' : 'by_document';
  try {
    const ExcelJS = require('exceljs');
    const companyId = company_id != null && company_id !== '' && !isNaN(parseInt(company_id, 10)) ? parseInt(company_id, 10) : null;
    const companyIds = !companyId && req.user?.id ? await getCurrentUserCompanyIds(req.user.id) : null;
    const params = [];
    const companyFilter = buildCompanyFilterJoin(company_id, companyIds, params);
    const buildWhere = (strict = true) => {
      const where = companyFilter ? [companyFilter.whereCond] : [];
      let pIdx = params.length + 1;
      if (status) { params.push(status); where.push(`ed.status = $${pIdx++}`); }
      if (project) { params.push(project); where.push(`ed.project_name = $${pIdx++}`); }
      if (card_no != null && String(card_no).trim() !== '') {
        params.push(`%${String(card_no).trim()}%`);
        where.push(`(ed.card_no ILIKE $${pIdx++})`);
      }
      if (strict) {
        if (period_from) { params.push(period_from); where.push(`ed.period_end >= $${pIdx++}`); }
        if (period_to) { params.push(period_to); where.push(`ed.period_start <= $${pIdx++}`); }
      }
      return { where, params };
    };
    let { where } = buildWhere(true);
    let whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const joinPart = companyFilter ? companyFilter.join : '';
    const fromClause = `FROM expense_items ei JOIN expense_documents ed ON ed.id = ei.document_id${joinPart}`;
    const selectCols = 'ei.id as item_id, ed.id as document_id, ed.doc_no, ei.use_date, ei.project_name, ei.account_item_name, ei.description, ei.card_amount, ei.cash_amount, ei.total_amount, ei.remark, ed.card_no, ed.user_name, ed.period_start, ed.period_end';
    let items = await db.query(`
      SELECT ${selectCols} ${fromClause} ${whereClause}
      ORDER BY ei.use_date, ei.id
    `, params);
    if (items.length === 0) {
      const fallback = buildWhere(false);
      whereClause = fallback.where.length ? ' WHERE ' + fallback.where.join(' AND ') : '';
      items = await db.query(`
        SELECT ${selectCols} ${fromClause} ${whereClause}
        ORDER BY ei.use_date DESC, ei.id
        LIMIT 2000
      `, params);
    }
    if (mode === 'by_document' && items.length > 0) {
      const docIds = [...new Set(items.map(i => i.document_id).filter(Boolean))];
      if (docIds.length > 0) {
        const ph = docIds.map((_, i) => `$${i + 1}`).join(',');
        const docOrderRes = await db.query(
          `SELECT id FROM expense_documents WHERE id IN (${ph}) ORDER BY period_start DESC, id DESC`,
          docIds
        );
        const docOrder = {};
        (docOrderRes || []).forEach((r, idx) => { docOrder[r.id] = idx; });
        items.sort((a, b) => {
          const oa = docOrder[a.document_id] ?? 999999;
          const ob = docOrder[b.document_id] ?? 999999;
          if (oa !== ob) return oa - ob;
          return (a.use_date || '').localeCompare(b.use_date || '') || ((a.item_id || 0) - (b.item_id || 0));
        });
      }
    }
    const digitsOnly = (s) => (s || '').replace(/\D/g, '');
    const registeredCards = [];
    const addCard = (cardNo, label, prio) => {
      if (!cardNo || !label) return;
      const digits = digitsOnly(cardNo);
      if (digits) registeredCards.push({ digits, label, prio });
    };
    const cids = companyId != null ? [companyId] : (companyIds || []);
    if (cids.length > 0) {
      const ph = cids.map((_, i) => `$${i + 1}`).join(',');
      const ccRows = await db.query('SELECT card_no, label FROM corporate_cards WHERE company_id IN (' + ph + ')', cids);
      ccRows.forEach(r => addCard(r.card_no, r.label, 2));
      const ucRows = await db.query('SELECT card_no, label FROM user_cards WHERE company_id IN (' + ph + ') OR company_id IS NULL', cids);
      ucRows.forEach(r => addCard(r.card_no, r.label, 1));
    } else {
      const ccRows = await db.query('SELECT card_no, label FROM corporate_cards');
      ccRows.forEach(r => addCard(r.card_no, r.label, 2));
      const ucRows = await db.query('SELECT card_no, label FROM user_cards');
      ucRows.forEach(r => addCard(r.card_no, r.label, 1));
    }
    const getCardLabel = (cardNo) => {
      if (!cardNo || cardNo === '__nocard__') return null;
      const expDigits = digitsOnly(cardNo);
      if (!expDigits) return null;
      let best = null, bestLen = 0, bestPrio = 0;
      for (const { digits, label, prio } of registeredCards) {
        const ok = expDigits === digits || expDigits.startsWith(digits) || digits.startsWith(expDigits);
        if (!ok) continue;
        const better = digits.length > bestLen || (digits.length === bestLen && prio > bestPrio);
        if (better) { best = label; bestLen = digits.length; bestPrio = prio; }
      }
      return best;
    };
    const maskCard = (c) => c ? String(c).replace(/(\d{4})-(\d{4})-(\d{4})-(\d+)/, '$1-$2-$3-****') : '-';
    const last4 = (cardNo) => {
      if (!cardNo || cardNo === '__nocard__') return '';
      const digits = String(cardNo).replace(/\D/g, '');
      return digits.length >= 4 ? digits.slice(-4) : digits;
    };
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

    const usedNames = new Set();
    const addSheet = (wb, sheetItems, tabName, cardNoForHeader, userProjectForHeader, totalCardForHeader, submitterName) => {
      let safeTabName = tabName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 31);
      let n = 1;
      while (usedNames.has(safeTabName)) {
        const suffix = ` (${++n})`;
        safeTabName = (tabName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 31 - suffix.length) + suffix).slice(0, 31);
      }
      usedNames.add(safeTabName);
      const ws = wb.addWorksheet(safeTabName, { views: [{ showGridLines: true }] });
      ws.columns = [
        { width: 12 }, { width: 18 }, { width: 14 }, { width: 28 },
        { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 8 },
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

    if (mode === 'by_item') {
      const ws = wb.addWorksheet('개별사용내역', { views: [{ showGridLines: true }] });
      ws.columns = [
        { width: 14 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 14 }, { width: 28 },
        { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 },
      ];
      const headers = ['문서번호', '사용자', '날짜', '현장', '항목', '세부사용내역', '카드', '현금', '합계', '비고'];
      headers.forEach((h, c) => { ws.getCell(1, c + 1).value = h; ws.getCell(1, c + 1).font = { bold: true }; });
      applyGridBorders(ws, 1, 1, 1, 10);
      items.forEach((i, idx) => {
        const r = idx + 2;
        ws.getCell(r, 1).value = i.doc_no || '';
        ws.getCell(r, 2).value = i.user_name || '';
        ws.getCell(r, 3).value = i.use_date || '';
        ws.getCell(r, 4).value = i.project_name || '';
        ws.getCell(r, 5).value = i.account_item_name || '';
        ws.getCell(r, 6).value = i.description || '';
        ws.getCell(r, 7).value = i.card_amount ?? 0;
        ws.getCell(r, 8).value = i.cash_amount ?? 0;
        ws.getCell(r, 9).value = i.total_amount ?? 0;
        ws.getCell(r, 10).value = i.remark || '';
        [7, 8, 9].forEach(col => { ws.getCell(r, col).numFmt = '#,##0'; });
      });
      const dataEndRow = items.length > 0 ? items.length + 1 : 1;
      if (items.length > 0) {
        const totalRow = dataEndRow + 1;
        ws.getCell(totalRow, 1).value = '합계';
        ws.getCell(totalRow, 7).value = items.reduce((s, i) => s + (i.card_amount || 0), 0);
        ws.getCell(totalRow, 8).value = items.reduce((s, i) => s + (i.cash_amount || 0), 0);
        ws.getCell(totalRow, 9).value = items.reduce((s, i) => s + (i.total_amount || 0), 0);
        [7, 8, 9].forEach(col => { ws.getCell(totalRow, col).numFmt = '#,##0'; ws.getCell(totalRow, col).font = { bold: true }; });
        applyGridBorders(ws, 2, 1, totalRow, 10);
      } else {
        ws.getCell(2, 1).value = '조회된 데이터가 없습니다.';
        ws.mergeCells(2, 1, 2, 10);
        ws.getCell(2, 1).alignment = { horizontal: 'center' };
        applyGridBorders(ws, 2, 1, 2, 10);
      }
    } else {
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
        const tabLabel = (c !== '__nocard__' && isDisplayCardFormat(c)) ? maskCard(c) : (c !== '__nocard__' ? (getCardLabel(c) || '미지정') : '미지정');
        const suffix = last4(c);
        const tabName = c !== '__nocard__' ? (suffix ? `${tabLabel} ${suffix}` : tabLabel) : '미지정카드';
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
