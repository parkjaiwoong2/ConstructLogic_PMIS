-- company_id 인덱스가 없는 테이블에 인덱스 추가
-- approval_sequences: company_id 기준 조회 (결재순서 회사별)

CREATE INDEX IF NOT EXISTS idx_approval_sequences_company ON approval_sequences(company_id, sort_order);
