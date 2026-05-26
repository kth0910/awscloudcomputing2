# Quick Deploy Guide - 동아리 행사 티켓팅 시스템 V1

## AWS 콘솔(웹 UI)만으로 배포하는 가이드

> Access Key 없이, AWS Management Console에서 모든 작업을 수행합니다.

---

## 사용 AWS 서비스

| 서비스 | 용도 | 리전 |
|--------|------|------|
| **AWS Amplify** | React 프론트엔드 호스팅 | us-east-1 |
| **API Gateway** | REST API 엔드포인트 | us-east-1 |
| **AWS Lambda** | 백엔드 비즈니스 로직 (Node.js 20.x) | us-east-1 |
| **DynamoDB** | 데이터 저장 (Events, Tickets 테이블) | us-east-1 |

---

## 1단계: DynamoDB 테이블 생성

### 1.1 Events 테이블

1. AWS 콘솔 → **DynamoDB** → 테이블 만들기
2. 설정:
   - 테이블 이름: `TicketingEvents`
   - 파티션 키: `eventId` (문자열)
   - 테이블 설정: 기본 설정 사용 (온디맨드)
3. 테이블 생성 후 → **인덱스** 탭 → **글로벌 보조 인덱스 생성**
   - 인덱스 이름: `status-index`
   - 파티션 키: `status` (문자열)
   - 프로젝션: 모든 속성

### 1.2 Tickets 테이블

1. AWS 콘솔 → **DynamoDB** → 테이블 만들기
2. 설정:
   - 테이블 이름: `TicketingTickets`
   - 파티션 키: `ticketId` (문자열)
   - 테이블 설정: 기본 설정 사용 (온디맨드)
3. 테이블 생성 후 → **인덱스** 탭 → 글로벌 보조 인덱스 생성:
   - 인덱스 이름: `ticketCode-index`
   - 파티션 키: `ticketCode` (문자열)
   - 프로젝션: 모든 속성

---

## 2단계: Lambda 함수 생성 (1개)

### 함수 생성

1. AWS 콘솔 → **Lambda** → 함수 생성
2. 설정:
   - 함수 이름: `pj-kmucloud-4-TicketingLambda`
   - 런타임: **Node.js 20.x**
   - 아키텍처: x86_64
   - 실행 역할: **기본 Lambda 권한을 가진 새 역할 생성**
3. 함수 생성 후 → **구성** → **일반 구성** → 편집:
   - 제한 시간: **30초**
   - 메모리: **256MB**
4. **구성** → **환경 변수** → 편집:
   - `EVENTS_TABLE` = `TicketingEvents`
   - `TICKETS_TABLE` = `TicketingTickets`
5. 생성된 역할에 DynamoDB 권한 추가:
   - **구성** → **권한** → 역할 이름 클릭 (IAM 콘솔로 이동)
   - **권한 추가** → **정책 연결** → `AmazonDynamoDBFullAccess` 검색 후 추가

> IAM 콘솔 접근이 안 되면 교수/관리자에게 역할에 `AmazonDynamoDBFullAccess` 정책 추가를 요청하세요.

### 코드 업로드

**ZIP 패키징 (로컬 PC에서):**

```bash
cd backend
npm install
```

Windows에서 ZIP 만들기:
- `backend` 폴더 안의 다음 항목들을 **모두 선택** → 우클릭 → ZIP으로 압축:
  - `index.js`
  - `handlers/` 폴더
  - `lib/` 폴더
  - `node_modules/` 폴더
  - `package.json`

> 주의: `backend` 폴더 자체를 압축하지 말고, **안의 파일/폴더들을** 선택해서 압축해야 합니다.

**업로드:**
1. Lambda 콘솔 → `pj-kmucloud-4-TicketingLambda` 함수 → 코드 탭
2. **에서 업로드** → **.zip 파일** → 위에서 만든 ZIP 선택
3. 핸들러 확인: **런타임 설정** → 핸들러가 `index.handler`인지 확인 (아니면 편집)

### ZIP 내부 구조

```
├── index.js              ← 통합 라우터 (진입점)
├── handlers/
│   ├── events.js         ← 행사 CRUD
│   ├── tickets.js        ← 티켓 신청/취소/조회
│   ├── admission.js      ← 입장 확인/처리
│   └── admin.js          ← 관리자 기능
├── lib/
│   ├── dynamodb.js
│   ├── response.js
│   └── auth.js
├── node_modules/
└── package.json
```

---

## 3단계: API Gateway 생성

### 3.1 REST API 생성

1. AWS 콘솔 → **API Gateway** → REST API → 구축
2. API 이름: `TicketingAPI`
3. 엔드포인트 유형: 리전

### 3.2 리소스 및 메서드 생성

아래 구조대로 리소스를 생성하고 각 메서드에 `pj-kmucloud-4-TicketingLambda` 함수를 연결합니다.

```
/
├── /events
│   ├── GET    → pj-kmucloud-4-TicketingLambda
│   ├── POST   → pj-kmucloud-4-TicketingLambda
│   └── /{eventId}
│       ├── GET    → pj-kmucloud-4-TicketingLambda
│       ├── PUT    → pj-kmucloud-4-TicketingLambda
│       ├── /status
│       │   └── PATCH  → pj-kmucloud-4-TicketingLambda
│       ├── /applicants
│       │   └── GET    → pj-kmucloud-4-TicketingLambda
│       ├── /stats
│       │   └── GET    → pj-kmucloud-4-TicketingLambda
│       └── /tickets
│           └── POST   → pj-kmucloud-4-TicketingLambda
├── /tickets
│   ├── /my
│   │   └── GET    → pj-kmucloud-4-TicketingLambda
│   └── /{ticketId}
│       └── DELETE → pj-kmucloud-4-TicketingLambda
├── /admission
│   ├── /verify
│   │   └── /{ticketCode}
│       │   └── GET    → pj-kmucloud-4-TicketingLambda
│   └── /enter
│       └── /{ticketCode}
│           └── POST   → pj-kmucloud-4-TicketingLambda
└── /admin
    └── /dashboard
        └── GET    → pj-kmucloud-4-TicketingLambda
```

### 리소스 생성 순서

1. `/events` 리소스 생성 → GET, POST 메서드 추가
2. `/events` 아래 `{eventId}` 리소스 생성 → GET, PUT 메서드 추가
3. `{eventId}` 아래 `/status` 생성 → PATCH 메서드 추가
4. `{eventId}` 아래 `/applicants` 생성 → GET 메서드 추가
5. `{eventId}` 아래 `/stats` 생성 → GET 메서드 추가
6. `{eventId}` 아래 `/tickets` 생성 → POST 메서드 추가
7. `/tickets` 리소스 생성
8. `/tickets` 아래 `/my` 생성 → GET 메서드 추가
9. `/tickets` 아래 `{ticketId}` 생성 → DELETE 메서드 추가
10. `/admission` 리소스 생성
11. `/admission` 아래 `/verify` 생성 → 그 아래 `{ticketCode}` 생성 → GET 메서드 추가
12. `/admission` 아래 `/enter` 생성 → 그 아래 `{ticketCode}` 생성 → POST 메서드 추가
13. `/admin` 리소스 생성 → 그 아래 `/dashboard` 생성 → GET 메서드 추가

### 메서드 생성 시 설정

각 메서드 생성 시:
- 통합 유형: **Lambda 함수**
- Lambda 프록시 통합 사용: ✅ 체크
- Lambda 함수: `pj-kmucloud-4-TicketingLambda`
- Lambda 권한 추가 팝업 → **확인**

### 3.3 CORS 활성화

각 리소스마다:
1. 리소스 선택 → **작업** → **CORS 활성화**
2. Access-Control-Allow-Headers: `Content-Type,X-User-Id,X-User-Role`
3. Access-Control-Allow-Origin: `*`
4. **CORS 활성화 및 기존 CORS 헤더 교체** 클릭

### 3.4 API 배포

1. **작업** → **API 배포**
2. 배포 스테이지: **새 스테이지** → 이름: `prod`
3. 배포 클릭
4. **호출 URL** 복사 (예: `https://aeu9stk6e0.execute-api.us-east-1.amazonaws.com/prod`)

---

## 4단계: 프론트엔드 배포 (Amplify)

### 4.1 빌드 준비 (로컬 PC)

```bash
cd frontend

# .env 파일에 API URL 설정
echo "VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod" > .env

npm install
npm run build
```

빌드 결과물: `frontend/dist/` 폴더

### 4.2 Amplify에 배포

**방법 A: GitHub 연동 (권장)**

1. 프로젝트를 GitHub에 push
2. AWS 콘솔 → **Amplify** → 새 앱 → **웹 앱 호스팅**
3. GitHub 연결 → 리포지토리/브랜치 선택
4. 빌드 설정:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend/dist
       files:
         - '**/*'
     cache:
       paths:
         - frontend/node_modules/**/*
   ```
5. 환경 변수 추가:
   - `VITE_API_URL` = `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod`
6. 저장 및 배포

**방법 B: 수동 배포 (ZIP 업로드)**

1. `frontend/dist/` 폴더를 ZIP으로 압축
2. AWS 콘솔 → **Amplify** → 새 앱 → **웹 앱 호스팅**
3. **Git 공급자 없이 배포** 선택
4. 앱 이름: `ticketing-frontend`
5. 환경: `main`
6. ZIP 파일 드래그 앤 드롭으로 업로드
7. 저장 및 배포

### 4.3 배포 완료

Amplify가 제공하는 URL로 접속 (예: `https://main.xxxxxxxxxx.amplifyapp.com`)

---

## 5단계: 배포 검증

브라우저에서 Amplify URL 접속 후:

1. **역할을 organizer로 변경** → 행사 등록 테스트
2. **역할을 student로 변경** → 티켓 신청 테스트
3. **역할을 gatekeeper로 변경** → 입장 확인 페이지에서 티켓 코드 입력
4. **역할을 admin으로 변경** → 대시보드에서 전체 현황 확인

---

## 전체 배포 체크리스트

| # | 작업 | 완료 |
|---|------|------|
| 1 | DynamoDB - TicketingEvents 테이블 생성 | ☐ |
| 2 | DynamoDB - TicketingEvents GSI (status-index) 생성 | ☐ |
| 3 | DynamoDB - TicketingTickets 테이블 생성 | ☐ |
| 4 | DynamoDB - TicketingTickets GSI (ticketCode-index) 생성 | ☐ |
| 5 | Lambda - pj-kmucloud-4-TicketingLambda 함수 생성 + ZIP 업로드 | ☐ |
| 6 | Lambda - 역할에 DynamoDBFullAccess 정책 추가 | ☐ |
| 7 | API Gateway - REST API 생성 | ☐ |
| 8 | API Gateway - 리소스/메서드 구성 (모두 pj-kmucloud-4-TicketingLambda 연결) | ☐ |
| 9 | API Gateway - CORS 활성화 | ☐ |
| 10 | API Gateway - prod 스테이지 배포 | ☐ |
| 11 | Frontend - .env에 API URL 설정 후 빌드 | ☐ |
| 12 | Amplify - 프론트엔드 배포 | ☐ |
| 13 | 전체 플로우 테스트 | ☐ |

---

## 리소스 정리 (삭제)

모두 AWS 콘솔에서 수행:

1. **Amplify** → 앱 삭제
2. **API Gateway** → API 삭제
3. **Lambda** → pj-kmucloud-4-TicketingLambda 함수 삭제
4. **DynamoDB** → 2개 테이블 삭제

---

## 비용 예상 (프리티어)

| 서비스 | 프리티어 | 예상 비용 |
|--------|----------|-----------|
| Lambda | 월 100만 요청 무료 | $0 |
| DynamoDB | 25GB, 25 WCU/RCU 무료 | $0 |
| API Gateway | 월 100만 호출 무료 (12개월) | $0 |
| Amplify | 빌드 1000분, 15GB 호스팅 무료 | $0 |
| **합계** | | **$0** |

---

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| CORS 에러 | API Gateway에서 각 리소스 CORS 활성화 확인, Lambda 응답에 CORS 헤더 포함 확인 |
| 403 Forbidden | API Gateway 배포 여부 확인 (변경 후 재배포 필요) |
| Lambda 핸들러 오류 | 핸들러가 `index.handler`로 설정되어 있는지 확인 |
| 모듈 not found | ZIP에 node_modules 포함 여부 확인, ZIP 루트에 index.js가 있는지 확인 |
| DynamoDB 접근 오류 | Lambda 역할에 DynamoDB 권한 확인, 환경변수 테이블 이름 확인 |
| Amplify 빌드 실패 | amplify.yml의 baseDirectory 경로 확인 |
