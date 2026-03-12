-- 요금제(subscription_plans) 및 회사별 구독(company_subscriptions) 테이블

-- 요금제 마스터
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly INTEGER DEFAULT 0,
  max_users INTEGER DEFAULT 10,
  features_json JSONB DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  is_trial BOOLEAN DEFAULT false,
  trial_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- 회사별 구독 (할당된 요금제)
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul'),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'Asia/Seoul'),
  UNIQUE(company_id)
);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_plan ON company_subscriptions(plan_id);
