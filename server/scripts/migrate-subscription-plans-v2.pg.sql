-- subscription_plans 확장: setup_fee, is_recommended, plan_type, limits_json

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS setup_fee INTEGER DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'basic';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS limits_json JSONB DEFAULT '{}';
