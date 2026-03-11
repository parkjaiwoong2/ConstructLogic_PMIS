#!/usr/bin/env node
/**
 * 작성자1 문서 기준 결재선 흐름 추적
 * node server/scripts/trace-approval-flow.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

async function main() {
  console.log('=== 1. 작성자1(auth_users) 정보 ===');
  const author = await db.queryOne('SELECT id, name, email, company_id FROM auth_users WHERE name = $1', ['작성자1']);
  console.log(author || '작성자1 없음');

  console.log('\n=== 2. CARD-IMPORT-177 로 시작하는 문서 (화면과 유사) ===');
  const docs = await db.query(`
    SELECT ed.id, ed.doc_no, ed.user_name, ed.company_id, ed.status, c.name as company_name
    FROM expense_documents ed
    LEFT JOIN companies c ON c.id = ed.company_id
    WHERE ed.doc_no LIKE 'CARD-IMPORT-177%' OR ed.user_name = '작성자1'
    ORDER BY ed.id DESC LIMIT 10
  `);
  console.log(docs);

  if (docs.length === 0) {
    console.log('문서 없음. 전체 expense_documents 확인...');
    const all = await db.query('SELECT id, doc_no, user_name, company_id, status FROM expense_documents ORDER BY id DESC LIMIT 5');
    console.log(all);
  }

  // 문서 하나씩 GET API 시뮬레이션
  const targetDocs = docs.length ? docs : await db.query(`
    SELECT ed.id, ed.doc_no, ed.user_name, ed.company_id, ed.status, c.name as company_name
    FROM expense_documents ed
    LEFT JOIN companies c ON c.id = ed.company_id
    WHERE ed.user_name = '작성자1'
    ORDER BY ed.id DESC LIMIT 5
  `);

  if (targetDocs.length === 0) {
    const any = await db.query('SELECT id, doc_no, user_name, company_id FROM expense_documents ORDER BY id DESC LIMIT 3');
    console.log('\n작성자1 문서 없음. 최근 문서:', any);
    for (const d of any) targetDocs.push(d);
  }

  console.log('\n=== 3. GET /api/documents/:id 로직 시뮬레이션 (문서별) ===');
  for (const doc of targetDocs) {
    console.log(`\n--- doc ${doc.id} (${doc.doc_no}), user_name=${doc.user_name}, company_id=${doc.company_id} (${doc.company_name || 'null'}) ---`);
    let companyId = doc.company_id;
    console.log('  초기 companyId:', companyId, 'typeof:', typeof companyId);

    if (!companyId && doc.user_name) {
      const au = await db.queryOne('SELECT id, company_id FROM auth_users WHERE name = $1 LIMIT 1', [doc.user_name]);
      console.log('  user lookup:', au);
      if (au) {
        companyId = au.company_id;
        if (!companyId) {
          const ids = await db.query(`
            SELECT company_id FROM auth_user_companies WHERE user_id = $1
            UNION
            SELECT company_id FROM auth_users WHERE LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM auth_users WHERE id = $1) AND company_id IS NOT NULL
          `, [au.id]);
          const idList = [...new Set((ids || []).map(r => r.company_id).filter(Boolean))];
          console.log('  getCompanyIds:', idList);
          if (idList.length) {
            const defRow = await db.queryOne('SELECT id FROM companies WHERE is_default = true');
            companyId = (defRow && idList.includes(defRow.id)) ? defRow.id : idList[0];
          }
        }
      }
    }
    if (!companyId) {
      companyId = (await db.queryOne('SELECT id FROM companies WHERE is_default = true'))?.id;
    }
    if (!companyId) {
      companyId = (await db.queryOne('SELECT id FROM companies ORDER BY id LIMIT 1'))?.id;
    }
    console.log('  최종 companyId:', companyId);

    const sequences = companyId
      ? await db.query('SELECT role FROM approval_sequences WHERE company_id = $1 ORDER BY sort_order ASC', [companyId])
      : [];
    console.log('  sequences:', sequences);
    console.log('  approval_sequences_configured:', (sequences || []).length > 0);
  }

  console.log('\n=== 4. approval_sequences 전체 (company_id별) ===');
  const seqs = await db.query('SELECT company_id, role, sort_order FROM approval_sequences ORDER BY company_id, sort_order');
  console.log(seqs);

  console.log('\n=== 5. companies ===');
  const companies = await db.query('SELECT id, name, is_default FROM companies ORDER BY id');
  console.log(companies);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
