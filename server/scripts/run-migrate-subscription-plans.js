#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') });
const fs = require('fs');
const db = require('../db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrate-subscription-plans.pg.sql'), 'utf8');
  await db.pool.query(sql);
  console.log('subscription_plans, company_subscriptions tables OK');

  const plans = await db.query('SELECT id FROM subscription_plans LIMIT 1');
  if (!plans?.length) {
    await db.run(`INSERT INTO subscription_plans (code, name, description, price_monthly, max_users, features_json, display_order, is_trial, trial_days)
      VALUES 
        ('trial', '무료체험', '14일간 전체 기능 사용', 0, 5, '["사용내역 입력","결재","CSV 임포트","대시보드"]', 1, true, 14),
        ('starter', '스타터', '소규모 무료', 0, 5, '["전체 기능","최대 5명"]', 2, false, null),
        ('basic', '베이직', '소규모 건설사', 99000, 10, '["전체 기능","최대 10명"]', 3, false, null),
        ('pro', '프로', '중규모 건설사', 199000, 50, '["전체 기능","최대 50명","우선 지원"]', 4, false, null),
        ('enterprise', '엔터프라이즈', '대규모 맞춤형', 0, 999, '["전체 기능","무제한 사용자","전담 지원"]', 5, false, null)`);
    console.log('Default subscription plans seeded');
  }

  const companies = await db.query('SELECT id FROM companies');
  for (const c of companies || []) {
    const exists = await db.queryOne('SELECT 1 FROM company_subscriptions WHERE company_id = $1', [c.id]);
    if (!exists) {
      const starterPlan = await db.queryOne('SELECT id FROM subscription_plans WHERE code = $1', ['starter']);
      const planId = starterPlan?.id || (await db.queryOne('SELECT id FROM subscription_plans ORDER BY display_order LIMIT 1'))?.id;
      if (planId) {
        await db.run(
          'INSERT INTO company_subscriptions (company_id, plan_id, status) VALUES ($1, $2, $3)',
          [c.id, planId, 'active']
        );
      }
    }
  }
  console.log('Existing companies assigned default plan');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
