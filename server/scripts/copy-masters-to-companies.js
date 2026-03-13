/**
 * 마스터관리(슈퍼관리자) 템플릿을 지정 회사의 계정·현장으로 복사
 * node server/scripts/copy-masters-to-companies.js
 *
 * 대상: 동생사용회사1, 동생상용회사2, 동생사용회사2 (오타 포함)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

const TARGET_NAMES = ['동생사용회사1', '동생상용회사2', '동생사용회사2', '동생 사용 회사2'];

async function run() {
  const companies = await db.query(
    "SELECT id, name FROM companies WHERE name = ANY($1::text[])",
    [TARGET_NAMES]
  );
  const uniqueById = new Map();
  for (const c of companies) {
    if (!uniqueById.has(c.id)) uniqueById.set(c.id, c);
  }
  const targets = [...uniqueById.values()];
  if (targets.length === 0) {
    console.log('대상 회사를 찾을 수 없습니다:', TARGET_NAMES.join(', '));
    process.exit(1);
  }
  console.log('대상 회사:', targets.map(c => `${c.name}(id=${c.id})`).join(', '));

  const [tplAccounts, tplProjects] = await Promise.all([
    db.query('SELECT code, name, display_order FROM master_templates_account_items ORDER BY display_order, id'),
    db.query('SELECT code, name FROM master_templates_projects ORDER BY id'),
  ]);
  if (!tplAccounts?.length && !tplProjects?.length) {
    console.log('마스터 템플릿이 비어있습니다. 마스터관리(슈퍼관리자)에 등록 후 다시 실행하세요.');
    process.exit(1);
  }
  console.log(`템플릿: 계정과목 ${tplAccounts?.length || 0}건, 현장 ${tplProjects?.length || 0}건`);

  let totalAi = 0;
  let totalProj = 0;

  for (const company of targets) {
    const cid = company.id;
    let aiInserted = 0;
    let projInserted = 0;

    for (const t of tplAccounts || []) {
      const code = t.code || `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const existing = await db.queryOne(
        'SELECT 1 FROM account_items WHERE company_id = $1 AND code = $2 LIMIT 1',
        [cid, code]
      );
      if (!existing) {
        await db.run(
          'INSERT INTO account_items (company_id, code, name, display_order) VALUES ($1, $2, $3, $4)',
          [cid, code, t.name, t.display_order ?? 0]
        );
        aiInserted++;
      }
    }

    for (const t of tplProjects || []) {
      const existing = await db.queryOne(
        'SELECT 1 FROM projects WHERE company_id = $1 AND name = $2 LIMIT 1',
        [cid, t.name]
      );
      if (!existing) {
        let code = t.code?.trim() || null;
        if (!code) code = `P${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 6)}`;
        await db.run(
          'INSERT INTO projects (company_id, code, name) VALUES ($1, $2, $3)',
          [cid, code, t.name]
        );
        projInserted++;
      }
    }

    totalAi += aiInserted;
    totalProj += projInserted;
    console.log(`  ${company.name}: 계정과목 +${aiInserted}건, 현장 +${projInserted}건`);
  }

  console.log(`\n완료: 계정과목 ${totalAi}건, 현장 ${totalProj}건 복사됨`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
