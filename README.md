# CONSTRUCT LOGIC PMIS

건설 프로젝트 관리 정보 시스템 - 카드/현금 사용내역 관리 및 결재

## 구조

```
CONSTRUCT_LOGIC/
├── server/          # 백엔드 API (Express + PostgreSQL/Supabase)
├── client/          # 프론트엔드 (React + Vite)
├── .env             # DB 접속 정보 (Supabase)
└── *.csv            # 엑셀 원본 데이터
```

## 주요 기능

- **카드/현금 사용내역 입력**: 계정과목 자동 매핑 지원
- **결재 시스템**: 문서별 승인/반려
- **CEO 대시보드**: 항목별/월별/건별 지출 집계, 이상 항목 검출
- **마스터 관리**: 계정과목, 현장(공사) 관리

## 실행 방법

```bash
# 의존성 설치
npm install
cd client && npm install

# .env 파일 생성 ( .env.example 참고하여 DB 정보 입력 )
# Supabase: https://supabase.com

# DB 테이블 생성 및 시드
npm run db:init

# 개발 서버 실행 (백엔드 + 프론트엔드 동시)
npm run dev
```

- 백엔드: http://localhost:3001
- 프론트엔드: http://localhost:5173

## 로그인

로그인 모듈은 차후 구현 예정입니다. 현재는 인증 없이 사용 가능합니다.
