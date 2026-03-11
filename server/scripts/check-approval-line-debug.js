#!/usr/bin/env node
/**
 * 결재선 디버그: companies, approval_sequences, expense_documents 상태 확인
 * node server/scripts/check-approval-line-debug.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function main() {
  console.log('=== 1. companies ===');
  const companies = await db.query('SELECT id, name, is_default FROM companies ORDER BY id');
  console.log(companies);

  console.log('\n=== 2. approval_sequences (회사별 결재선) ===');
  const seqs = await db.query('SELECT id, company_id, role, sort_order FROM approval_sequences ORDER BY company_id, sort_order');
  console.log(seqs);
  if (seqs.length === 0) {
    console.log('  -> approval_sequences에 데이터 없음! 결재순서 설정에서 역할을 추가해야 함');
  }

  console.log('\n=== 3. expense_documents (최근 5건) ===');
  const docs = await db.query(`
    SELECT ed.id, ed.doc_no, ed.user_name, ed.company_id, ed.status, c.name as company_name
    FROM expense_documents ed
    LEFT JOIN companies c ON c.id = ed.company_id
    ORDER BY ed.id DESC LIMIT 5
  `);
  console.log(docs);

  console.log('\n=== 4. 문서 company_id와 approval_sequences 매칭 확인 ===');
  for (const doc of docs) {
    const seqCount = await db.queryOne('SELECT COUNT(*)::int as c FROM approval_sequences WHERE company_id = $1', [doc.company_id]);
    console.log(`  doc ${doc.id} (${doc.doc_no}): company_id=${doc.company_id} (${doc.company_name}), 결재선 rows=${seqCount?.c ?? 0}`);
  }

  const unnonByName = await db.queryOne("SELECT id, name FROM companies WHERE name LIKE '%언넌%' OR name LIKE '%unnon%'");
  console.log('\n=== 5. 언넌 관련 회사 ===', unnonByName || '없음');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
