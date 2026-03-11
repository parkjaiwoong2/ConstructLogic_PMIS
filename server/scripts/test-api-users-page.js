/**
 * API users-page 직접 호출 테스트
 * 1. 로그인 → 토큰 획득
 * 2. users-page?company_id=1 호출
 * 3. 결과를 파일로 저장
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });

const BASE = process.env.API_URL || 'http://localhost:3000';

async function main() {
  console.log('1. 로그인 (zangruri@gmail.com)...');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'zangruri@gmail.com', password: '10041004' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    console.error('로그인 실패:', loginData);
    return;
  }
  console.log('   토큰 획득');

  console.log('2. users-page?company_id=1 호출...');
  const usersRes = await fetch(`${BASE}/api/admin/batch/users-page?company_id=1&limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const usersData = await usersRes.json();
  console.log('   status:', usersRes.status);
  console.log('   rows 개수:', usersData.rows?.length ?? 0);
  console.log('   total:', usersData.total);

  const fs = require('fs');
  const outPath = require('path').join(__dirname, '..', '..', 'api-users-page-result.json');
  fs.writeFileSync(outPath, JSON.stringify(usersData, null, 2), 'utf8');
  console.log('3. 결과 저장:', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
