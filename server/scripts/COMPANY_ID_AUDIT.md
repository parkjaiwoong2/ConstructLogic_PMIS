# 회사 코드(company_id) 점검 현황

회사별 데이터 분리와 조회를 위한 `company_id` 컬럼 점검 결과입니다.

## company_id가 필요한 테이블 (회사별 데이터)

| 테이블 | company_id | 비고 |
|--------|------------|------|
| expense_documents | ✅ 있음 | 결재문서. 마이그레이션+백필 적용 |
| account_items | ✅ 있음 | 계정과목 마스터 |
| projects | ✅ 있음 | 현장 마스터 |
| user_cards | ✅ 있음 | 사용자별 법인카드 |
| corporate_cards | ✅ 있음 | 법인카드 마스터 (PK가 아님, NOT NULL) |
| auth_users | ✅ 있음 | 대표회사 (멀티소속은 auth_user_companies) |
| approval_sequences | ✅ 있음 | 회사별 결재순서 |
| company_settings | ✅ 있음 | company_id가 PK |
| role_menus | ✅ 있음 | 회사별 메뉴 권한 |

## company_id 불필요 (공통/관리자 데이터)

| 테이블 | 사유 |
|--------|------|
| companies | 회사 마스터 자체 |
| roles | 역할 코드 (공통 마스터) |
| master_templates_account_items | 신규 회사 생성 시 템플릿 (슈퍼관리자) |
| master_templates_projects | 신규 회사 생성 시 템플릿 (슈퍼관리자) |
| account_mapping_rules | 키워드→항목 매핑 (관리 공통) |

## 부모 테이블 FK로 회사 구분 (company_id 불필요)

| 테이블 | 비고 |
|--------|------|
| expense_items | document_id → expense_documents.company_id |
| approval_history | document_id → expense_documents |
| admin_edit_history | document_id → expense_documents |

## 마이그레이션 스크립트

- `migrate-expense-documents-company.pg.sql` - company_id 컬럼 추가
- `migrate-expense-documents-company-backfill.pg.sql` - 기존 NULL 데이터 백필 (첫 번째/기본 회사)

## 실행 방법

```bash
psql $DATABASE_URL -f server/scripts/migrate-expense-documents-company.pg.sql
psql $DATABASE_URL -f server/scripts/migrate-expense-documents-company-backfill.pg.sql
```
