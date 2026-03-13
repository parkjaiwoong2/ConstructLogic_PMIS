-- role='superAdmin' 지원
-- 기존 is_admin=true 사용자를 role='superAdmin'으로 설정 (기존 admin은 그대로 유지)
UPDATE auth_users
SET role = 'superAdmin'
WHERE is_admin = true AND (role IS NULL OR role != 'superAdmin');
