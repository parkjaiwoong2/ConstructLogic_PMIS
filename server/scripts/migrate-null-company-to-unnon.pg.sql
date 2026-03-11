-- company_id가 NULL인 account_items, projects를 언넌플랫폼(id=2) 소속으로 변경
-- 언넌플랫폼이 is_default 회사

-- 1) account_items
UPDATE account_items
SET company_id = (SELECT id FROM companies WHERE name = '언넌플랫폼' LIMIT 1)
WHERE company_id IS NULL;

-- 2) projects
UPDATE projects
SET company_id = (SELECT id FROM companies WHERE name = '언넌플랫폼' LIMIT 1)
WHERE company_id IS NULL;
