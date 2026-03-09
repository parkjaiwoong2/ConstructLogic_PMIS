const db = require('../db');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// 계정과목 시드 (엑셀 6행 기준)
const accountItems = [
  { code: 'WELFARE', name: '복리후생비' },
  { code: 'SUPPLIES', name: '잡자재' },
  { code: 'SAFETY', name: '안전관리비' },
  { code: 'VEHICLE_REPAIR', name: '차량수리비' },
  { code: 'FUEL', name: '유류대' },
  { code: 'TRAVEL', name: '여비교통비' },
  { code: 'COMM', name: '통신비' },
  { code: 'OFFICE', name: '사무비' },
  { code: 'SITE_CASH', name: '현장전도금' },
  { code: 'RESERVE', name: '예비비' },
  { code: 'MISC', name: '잡비' },
  { code: 'VEHICLE_MAINT', name: '차량유지비' },
];

const stmt = db.prepare('INSERT OR IGNORE INTO account_items (code, name, display_order) VALUES (?, ?, ?)');
accountItems.forEach((a, i) => stmt.run(a.code, a.name, i + 1));

// 현장 시드
const projects = [{ code: 'BONCHON', name: '본촌배수지' }];
const pStmt = db.prepare('INSERT OR IGNORE INTO projects (code, name) VALUES (?, ?)');
projects.forEach(p => pStmt.run(p.code, p.name));

// 사용자 시드
const uStmt = db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)');
uStmt.run('배명수');

// 자동매핑 규칙 시드
const mappingRules = [
  { keyword: '기름', accountCode: 'FUEL' },
  { keyword: '주유', accountCode: 'FUEL' },
  { keyword: '유류', accountCode: 'FUEL' },
  { keyword: '요소수', accountCode: 'FUEL' },
  { keyword: '오일', accountCode: 'VEHICLE_REPAIR' },
  { keyword: '정비', accountCode: 'VEHICLE_REPAIR' },
  { keyword: '타이어', accountCode: 'VEHICLE_REPAIR' },
  { keyword: '브레이크', accountCode: 'VEHICLE_REPAIR' },
  { keyword: '중식', accountCode: 'WELFARE' },
  { keyword: '조식', accountCode: 'WELFARE' },
  { keyword: '석식', accountCode: 'WELFARE' },
  { keyword: '회식', accountCode: 'WELFARE' },
  { keyword: '식대', accountCode: 'WELFARE' },
  { keyword: '식권', accountCode: 'WELFARE' },
  { keyword: '음료', accountCode: 'WELFARE' },
  { keyword: '커피', accountCode: 'WELFARE' },
  { keyword: '라면', accountCode: 'WELFARE' },
  { keyword: '햇반', accountCode: 'WELFARE' },
  { keyword: '등기', accountCode: 'COMM' },
  { keyword: '택배', accountCode: 'COMM' },
  { keyword: '우편', accountCode: 'COMM' },
  { keyword: '하이패스', accountCode: 'TRAVEL' },
  { keyword: '제본', accountCode: 'OFFICE' },
  { keyword: '복사', accountCode: 'OFFICE' },
];

const accountMap = {};
db.prepare('SELECT id, code FROM account_items').all().forEach(r => { accountMap[r.code] = r.id; });

db.exec('DELETE FROM account_mapping_rules');
const mStmt = db.prepare('INSERT INTO account_mapping_rules (keyword, account_item_id, priority) VALUES (?, ?, ?)');
mappingRules.forEach((r, i) => {
  const aid = accountMap[r.accountCode];
  if (aid) mStmt.run(r.keyword, aid, 100 - i);
});

console.log('Seed completed. Account items:', accountItems.length, ', Projects:', projects.length, ', Mapping rules:', mappingRules.length);
