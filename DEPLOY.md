# Vercel 배포 가이드

## 환경 변수 설정 (필수)

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 아래 변수를 설정하세요.

### 방법 1: DATABASE_URL 사용 (권장)

Supabase 대시보드 → Database Settings → Connection string → **Transaction** (포트 6543) 선택 후 URI 복사.

```
postgres://postgres.xxxxx:[비밀번호]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

Vercel에 `DATABASE_URL` 또는 `POSTGRES_URL`로 저장. (Vercel에서 자동으로 `?pgbouncer=true&workaround=supabase-pooler.vercel` 추가됨)

### 방법 2: 개별 변수 사용

| 변수 | 값 |
|------|-----|
| DB_HOST | aws-1-ap-southeast-2.pooler.supabase.com |
| DB_PORT | 6543 |
| DB_USER | postgres.lhnytsihdfsgksvoahix |
| DB_PASSWORD | Supabase DB 비밀번호 |
| DB_NAME | postgres |

## DB 연결 확인

배포 후 `https://your-app.vercel.app/api/health` 접속:
- `{"ok":true,"db":"connected"}` → 정상
- `{"ok":false,"error":"..."}` → DB 설정 오류 (에러 메시지 확인)

## 문제 해결

- **데이터 조회 안됨**: `/api/health`에서 오류 확인 후 환경 변수 재검토
- **504 Timeout**: Supabase Transaction Pooler(6543) 사용 확인
- 환경 변수 변경 후 **Redeploy** 필요
