require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const db = require('../db');

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

async function run() {
  for (const a of accountItems) {
    await db.run(
      'INSERT INTO account_items (code, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING',
      [a.code, a.name, accountItems.indexOf(a) + 1]
    );
  }
  await db.run('INSERT INTO projects (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', ['BONCHON', '본촌배수지']);
  await db.run('INSERT INTO users (id, name) VALUES (1, $1) ON CONFLICT DO NOTHING', ['배명수']);

  const accounts = await db.query('SELECT id, code FROM account_items');
  const accountMap = {};
  accounts.forEach(r => { accountMap[r.code] = r.id; });

  await db.run('DELETE FROM account_mapping_rules');
  for (let i = 0; i < mappingRules.length; i++) {
    const r = mappingRules[i];
    const aid = accountMap[r.accountCode];
    if (aid) await db.run('INSERT INTO account_mapping_rules (keyword, account_item_id, priority) VALUES ($1, $2, $3)', [r.keyword, aid, 100 - i]);
  }
  console.log('Seed completed. Account items:', accountItems.length, ', Mapping rules:', mappingRules.length);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
