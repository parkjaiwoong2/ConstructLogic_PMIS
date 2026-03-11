#!/usr/bin/env node
/**
 * test2회사 및 company_id 관련 DB 상태 확인
 * node server/scripts/check-test2-company.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { Pool } = require('pg');

let connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connStr && process.env.DB_HOST) {
  connStr = `postgresql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || '6543'}/${process.env.DB_NAME || 'postgres'}`;
  if (connStr.includes('pooler.supabase.com')) connStr += (connStr.includes('?') ? '&' : '?') + 'pgbouncer=true';
}
const pool = new Pool({
  connectionString: connStr || 'postgresql://localhost:5432/postgres',
  ssl: connStr && (connStr.includes('supabase') || connStr.includes('pooler')) ? { rejectUnauthorized: false } : undefined
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== companies 테이블 (회사 목록) ===');
    const companies = await client.query('SELECT id, name, is_default FROM companies ORDER BY id');
    console.table(companies.rows);

    const test2 = companies.rows.find(c => c.name && c.name.includes('test2'));
    if (!test2) {
      console.log('\ntest2 회사가 없습니다.');
      return;
    }
    const test2Id = test2.id;
    console.log(`\n=== test2회사 id: ${test2Id} ===`);

    console.log('\n=== account_items (계정과목) - company_id별 건수 ===');
    const aiCount = await client.query(
      'SELECT company_id, COUNT(*) as cnt FROM account_items GROUP BY company_id ORDER BY company_id NULLS FIRST'
    );
    console.table(aiCount.rows);

    console.log('\n=== account_items WHERE company_id = $1 (test2회사 계정과목) ===', [test2Id]);
    const aiTest2 = await client.query(
      'SELECT id, company_id, code, name FROM account_items WHERE company_id = $1 ORDER BY id',
      [test2Id]
    );
    console.table(aiTest2.rows);
    console.log(`총 ${aiTest2.rows.length}건`);

    console.log('\n=== projects (현장) - company_id별 건수 ===');
    const projCount = await client.query(
      'SELECT company_id, COUNT(*) as cnt FROM projects GROUP BY company_id ORDER BY company_id NULLS FIRST'
    );
    console.table(projCount.rows);

    console.log('\n=== projects WHERE company_id = $1 (test2회사 현장) ===', [test2Id]);
    const projTest2 = await client.query(
      'SELECT id, company_id, code, name FROM projects WHERE company_id = $1 ORDER BY id',
      [test2Id]
    );
    console.table(projTest2.rows);
    console.log(`총 ${projTest2.rows.length}건`);

    console.log('\n=== master_templates_account_items 건수 (신규 회사 생성 시 사용) ===');
    const tplAi = await client.query('SELECT COUNT(*) as cnt FROM master_templates_account_items');
    console.log('건수:', tplAi.rows[0]?.cnt ?? 0);

    console.log('\n=== master_templates_projects 건수 ===');
    const tplProj = await client.query('SELECT COUNT(*) as cnt FROM master_templates_projects');
    console.log('건수:', tplProj.rows[0]?.cnt ?? 0);

    console.log('\n[해석]');
    console.log('- companies.id = 회사 식별자(company_id). test2회사 생성 시 id가 부여됨.');
    console.log('- account_items, projects에는 company_id 컬럼으로 회사 소속 저장.');
    console.log('- test2의 account_items/projects가 0건이면: master_templates가 비어있어서 생성 시 복사된 항목이 없음.');
    console.log('- 또는 test2가 슈퍼관리자 화면이 아닌 다른 경로로 생성되었을 수 있음.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
