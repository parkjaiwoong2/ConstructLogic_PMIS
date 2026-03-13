require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
const auth = require('../auth');

const MENUS = [
  { path: '/', label: '대시보드' },
  { path: '/expense/new', label: '사용내역 입력' },
  { path: '/expenses', label: '사용내역 조회' },
  { path: '/import', label: 'CSV 임포트' },
  { path: '/approval-processing', label: '결재처리' },
  { path: '/card-management', label: '법인카드 관리' },
  { path: '/masters', label: '마스터 관리' },
  { path: '/settings', label: '설정' },
  { path: '/admin/company', label: '회사 등록' },
  { path: '/admin/permissions', label: '권한관리' },
];

async function run() {
  let c = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
  if (!c) c = await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1');
  let companyId = c?.id;
  if (!companyId) {
    const ins = await db.run('INSERT INTO companies (name, is_default) VALUES ($1, true) RETURNING id', ['PMIS']);
    companyId = ins.rows[0].id;
  } else {
    await db.run('UPDATE companies SET is_default = false');
    await db.run('UPDATE companies SET is_default = true WHERE id = $1', [companyId]);
  }

  const defaultRoles = [
    { code: 'admin', label: '관리자', order: 0 },
    { code: 'author', label: '작성자', order: 1 },
    { code: 'reviewer', label: '검토자', order: 2 },
    { code: 'approver', label: '승인자', order: 3 },
    { code: 'ceo', label: 'CEO', order: 4 },
  ];
  for (const r of defaultRoles) {
    await db.run(
      'INSERT INTO roles (company_id, code, label, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT (company_id, code) DO NOTHING',
      [companyId, r.code, r.label, r.order]
    );
  }

  const pwHash = await auth.hashPassword('10041004');
  await db.run(
    `INSERT INTO auth_users (company_id, email, password_hash, name, role, is_admin, is_approved)
     VALUES ($1, $2, $3, $4, 'admin', true, true)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $4, is_admin = true, is_approved = true`,
    [companyId, 'zangruri@gmail.com', pwHash, '관리자']
  );

  for (const role of ['author', 'reviewer', 'approver', 'ceo']) {
    for (const m of MENUS.filter(x => !x.path.startsWith('/admin'))) {
      await db.run(
        'INSERT INTO role_menus (company_id, role, menu_path) VALUES ($1, $2, $3) ON CONFLICT (company_id, role, menu_path) DO NOTHING',
        [companyId, role, m.path]
      );
    }
  }
  for (const m of MENUS) {
    await db.run(
      'INSERT INTO role_menus (company_id, role, menu_path) VALUES ($1, $2, $3) ON CONFLICT (company_id, role, menu_path) DO NOTHING',
      [companyId, 'admin', m.path]
    );
  }

  const seq = [
    { role: 'reviewer', order: 1 },
    { role: 'approver', order: 2 },
    { role: 'ceo', order: 3 },
  ];
  await db.run('DELETE FROM approval_sequences WHERE company_id = $1', [companyId]);
  for (const s of seq) {
    await db.run('INSERT INTO approval_sequences (company_id, role, sort_order) VALUES ($1, $2, $3)', [companyId, s.role, s.order]);
  }

  console.log('Auth seed done. Admin: zangruri@gmail.com / 10041004');
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
