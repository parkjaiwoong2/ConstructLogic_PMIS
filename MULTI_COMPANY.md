# 멀티회사 운영 설계

## 원칙
- **모든 테이블에 회사(company_id) 기본 포함**  
  데이터는 회사 단위로 관리되며, 향후 회사 추가 시 확장 가능하도록 설계됩니다.

- **관리자(admin) 회사**  
  관리자(`is_admin=true` 또는 `role='admin'`)는 회사와 무관하게 모든 데이터 접근/수정이 가능합니다.  
  (권장: 관리자 계정은 `auth_users.company_id`를 null 또는 별도 "admin" 회사로 설정)

- **일반 사용자**  
  자신이 소속된 회사(`auth_users.company_id`)의 데이터만 조회/수정할 수 있습니다.

## 주요 테이블
- `approval_sequences`, `company_settings` - 회사별 결재순서/자동승인
- `user_cards` - 회사별 카드 (company_id)
- `auth_users` - 사용자 소속 회사 (company_id)
- `expense_documents` - 문서 작성자(user_name) → auth_users → company_id로 회사 연결

## 마이그레이션
```bash
node server/scripts/run-migrate-user-cards-company.js
```
