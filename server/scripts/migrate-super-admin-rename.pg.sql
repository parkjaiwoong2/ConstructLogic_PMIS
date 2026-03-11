-- zangruri@gmail.com 계정 이름을 '슈퍼관리자'로 변경
-- user_id 없고 user_name='배명수'인 데이터를 모두 슈퍼관리자(이름)로 업데이트

-- 1) auth_users: zangruri@gmail.com 이름을 슈퍼관리자로 변경
UPDATE auth_users SET name = '슈퍼관리자' WHERE email = 'zangruri@gmail.com';

-- 2) expense_documents: user_id 없고 user_name='배명수' → user_name='슈퍼관리자'
UPDATE expense_documents
SET user_name = '슈퍼관리자'
WHERE user_name = '배명수'
  AND (user_id IS NULL);

-- 3) user_cards: user_name='배명수' → '슈퍼관리자'
UPDATE user_cards SET user_name = '슈퍼관리자' WHERE user_name = '배명수';

-- 4) user_settings: user_name='배명수' → '슈퍼관리자'
-- 슈퍼관리자 행이 이미 있으면 배명수 행 삭제 (중복 PK 방지)
DELETE FROM user_settings WHERE user_name = '배명수'
  AND EXISTS (SELECT 1 FROM user_settings WHERE user_name = '슈퍼관리자');
UPDATE user_settings SET user_name = '슈퍼관리자' WHERE user_name = '배명수';
