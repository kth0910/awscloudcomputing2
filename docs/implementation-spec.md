# 동아리 행사 티켓팅 및 입장 확인 시스템 - V1 구현 명세서

## 1. 시스템 개요

동아리가 행사를 등록하고, 학생들이 티켓을 신청하며, 행사 당일 입장 확인 담당자가 티켓 코드로 입장 가능 여부를 검증하는 서비스.

## 2. 아키텍처 개요 (V1 - 최소 인프라)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API Gateway │────▶│  Lambda Functions│────▶│   DynamoDB  │
│  (Amplify)  │     │  (REST API)  │     │  (Node.js 20.x) │     │  (Tables)   │
└─────────────┘     └──────────────┘     └──────────────────┘     └─────────────┘
```

### 사용 AWS 서비스

| 서비스 | 용도 |
|--------|------|
| **Amplify** | 프론트엔드 호스팅 (React SPA) |
| **API Gateway** | REST API 엔드포인트 |
| **Lambda** | 비즈니스 로직 처리 |
| **DynamoDB** | 데이터 저장소 |
| **S3** | Lambda 배포 패키지 저장 |

### V1 선택 이유

- **서버리스 아키텍처**: EC2 대비 관리 부담 최소화, 트래픽 없을 때 비용 0
- **DynamoDB**: RDS 대비 스키마 유연성, 서버리스 환경과 자연스러운 통합
- **Amplify**: S3+CloudFront 수동 구성 대비 간편한 CI/CD 및 호스팅

---

## 3. 핵심 사용자 및 역할

| 역할 | 설명 |
|------|------|
| 행사 주최자 (Organizer) | 행사 등록/수정/관리, 신청자 목록 조회 |
| 참가 학생 (Student) | 티켓 신청/취소/조회 |
| 입장 관리자 (GateKeeper) | 티켓 코드로 입장 검증 처리 |
| 운영자 (Admin) | 전체 행사 현황 조회 |

---

## 4. 데이터 모델 (DynamoDB)

### 4.1 Events 테이블

| 속성 | 타입 | 설명 |
|------|------|------|
| `eventId` (PK) | String (UUID) | 행사 고유 ID |
| `organizerId` | String | 주최자 ID |
| `title` | String | 행사명 |
| `description` | String | 행사 설명 |
| `venue` | String | 장소 |
| `eventDate` | String (ISO8601) | 행사 일시 |
| `capacity` | Number | 모집 정원 |
| `registrationDeadline` | String (ISO8601) | 신청 마감 시간 |
| `currentCount` | Number | 현재 신청 인원 |
| `status` | String | 모집중/모집마감/행사종료/취소 |
| `createdAt` | String (ISO8601) | 생성 시간 |
| `updatedAt` | String (ISO8601) | 수정 시간 |

**GSI**: `status-index` (PK: status) - 상태별 행사 조회용

### 4.2 Tickets 테이블

| 속성 | 타입 | 설명 |
|------|------|------|
| `ticketId` (PK) | String (UUID) | 티켓 고유 ID |
| `ticketCode` | String | 입장용 티켓 코드 (8자리 영숫자) |
| `eventId` | String | 행사 ID |
| `studentId` | String | 학생 ID |
| `status` | String | 발급완료/입장완료/취소 |
| `issuedAt` | String (ISO8601) | 발급 시간 |
| `enteredAt` | String (ISO8601) | 입장 처리 시간 |
| `cancelledAt` | String (ISO8601) | 취소 시간 |

**GSI**:
- `ticketCode-index` (PK: ticketCode) - 티켓 코드로 조회 (입장 확인용)

> 중복 신청 확인(eventId+studentId)과 학생별 티켓 조회(studentId)는 Scan + FilterExpression으로 처리합니다.
> 테이블당 GSI 1개 제한 환경에 맞춘 설계입니다.

---

## 5. API 엔드포인트 설계

### 5.1 행사 관리 (Events)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/events` | 행사 등록 | Organizer |
| GET | `/events` | 행사 목록 조회 (모집중) | All |
| GET | `/events/{eventId}` | 행사 상세 조회 | All |
| PUT | `/events/{eventId}` | 행사 정보 수정 | Organizer |
| PATCH | `/events/{eventId}/status` | 행사 상태 변경 | Organizer |
| GET | `/events/{eventId}/applicants` | 신청자 목록 조회 | Organizer |
| GET | `/events/{eventId}/stats` | 입장 현황 조회 | Organizer |

### 5.2 티켓 관리 (Tickets)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/events/{eventId}/tickets` | 티켓 신청 | Student |
| GET | `/tickets/my` | 내 티켓 목록 조회 | Student |
| DELETE | `/tickets/{ticketId}` | 티켓 취소 | Student |

### 5.3 입장 확인 (Admission)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/admission/verify/{ticketCode}` | 티켓 유효성 확인 | GateKeeper |
| POST | `/admission/enter/{ticketCode}` | 입장 처리 | GateKeeper |

### 5.4 운영자 (Admin)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/admin/dashboard` | 전체 행사 현황 | Admin |

---

## 6. 비즈니스 로직 상세

### 6.1 행사 등록 (POST /events)

```
입력: title, description, venue, eventDate, capacity, registrationDeadline
처리:
  1. 필수 필드 검증
  2. eventId(UUID) 생성
  3. status = "모집중", currentCount = 0 설정
  4. Events 테이블에 저장
출력: 생성된 행사 정보
```

### 6.2 행사 수정 (PUT /events/{eventId})

```
입력: description, venue, capacity, registrationDeadline (수정 가능 필드)
처리:
  1. 행사 존재 여부 확인
  2. 주최자 본인 확인
  3. status가 "모집중"인 경우만 수정 가능
  4. 수정 가능 필드만 업데이트
출력: 수정된 행사 정보
```

### 6.3 티켓 신청 (POST /events/{eventId}/tickets)

```
입력: eventId, studentId (헤더에서 추출)
처리:
  1. 행사 존재 및 status="모집중" 확인
  2. registrationDeadline 미경과 확인
  3. 동일 학생 중복 신청 확인 (eventId-studentId-index 조회)
  4. 정원 초과 확인 (currentCount < capacity)
  5. DynamoDB 트랜잭션:
     - Tickets 테이블에 티켓 생성 (status="발급완료")
     - Events 테이블 currentCount +1 (조건부: currentCount < capacity)
  6. ticketCode 생성 (8자리 영숫자, 유일성 보장)
출력: ticketId, ticketCode
```

### 6.4 티켓 취소 (DELETE /tickets/{ticketId})

```
입력: ticketId, studentId (헤더에서 추출)
처리:
  1. 티켓 존재 및 본인 소유 확인
  2. 티켓 status="발급완료" 확인 (입장완료/취소 상태면 거부)
  3. 해당 행사 status="모집중" 확인 (모집마감 후 취소 불가)
  4. DynamoDB 트랜잭션:
     - Tickets 테이블 status="취소", cancelledAt 기록
     - Events 테이블 currentCount -1
출력: 취소 완료 메시지
```

### 6.5 입장 확인 (GET /admission/verify/{ticketCode})

```
입력: ticketCode
처리:
  1. ticketCode-index로 티켓 조회
  2. 티켓 존재 여부 확인
  3. 티켓 status 확인:
     - "발급완료" → 입장 가능
     - "입장완료" → 이미 입장 처리됨 (재입장 불가)
     - "취소" → 취소된 티켓
  4. 해당 행사 status 확인:
     - "취소" → 취소된 행사 (입장 불가)
출력: { valid: boolean, reason: string, ticketInfo: {...} }
```

### 6.6 입장 처리 (POST /admission/enter/{ticketCode})

```
입력: ticketCode
처리:
  1. verify 로직 동일하게 유효성 확인
  2. 유효한 경우에만:
     - Tickets 테이블 status="입장완료", enteredAt=현재시간
출력: 입장 처리 결과
```

---

## 7. Lambda 함수 구성

| 함수명 | 담당 API | 설명 |
|--------|----------|------|
| `createEvent` | POST /events | 행사 등록 |
| `getEvents` | GET /events | 행사 목록 조회 |
| `getEvent` | GET /events/{eventId} | 행사 상세 조회 |
| `updateEvent` | PUT /events/{eventId} | 행사 수정 |
| `updateEventStatus` | PATCH /events/{eventId}/status | 상태 변경 |
| `getApplicants` | GET /events/{eventId}/applicants | 신청자 목록 |
| `getEventStats` | GET /events/{eventId}/stats | 입장 현황 |
| `createTicket` | POST /events/{eventId}/tickets | 티켓 신청 |
| `getMyTickets` | GET /tickets/my | 내 티켓 조회 |
| `cancelTicket` | DELETE /tickets/{ticketId} | 티켓 취소 |
| `verifyTicket` | GET /admission/verify/{ticketCode} | 입장 확인 |
| `processEntry` | POST /admission/enter/{ticketCode} | 입장 처리 |
| `getDashboard` | GET /admin/dashboard | 운영 현황 |

---

## 8. 인증/인가 (V1 간소화)

V1에서는 Cognito 없이 간소화된 인증 방식 사용:
- API Gateway의 커스텀 헤더로 사용자 식별
  - `X-User-Id`: 사용자 ID
  - `X-User-Role`: organizer / student / gatekeeper / admin
- Lambda 내부에서 역할 기반 접근 제어

> V2에서 Cognito User Pool 도입 예정

---

## 9. 프론트엔드 구성 (React)

### 페이지 구조

```
/                       → 행사 목록 (모집중 행사)
/events/:id             → 행사 상세 + 티켓 신청
/my-tickets             → 내 티켓 목록
/organizer/events       → 주최자 행사 관리
/organizer/events/new   → 행사 등록
/organizer/events/:id   → 행사 수정 + 신청자/입장 현황
/gate                   → 입장 확인 (티켓 코드 입력)
/admin                  → 운영자 대시보드
```

---

## 10. 이벤트스토밍 기반 도메인 이벤트 흐름

### 행사 등록과 관리
```
행사 주최자 → 행사관리 시스템 → 행사정보 입력
  → 행사명/설명/장소/모집정원/신청마감시간 입력됨
  → 행사 등록됨
  → 행사 상태: 모집중

행사 주최자 → 행사정보 수정
  → 행사명/설명/장소/모집정원/신청마감시간 수정됨

스케줄러 → 인원 모집마감 시 마감됨 → 행사가 종료됨
행사 주최자 → 행사 취소 → 취소된 행사 신청 불가
```

### 티켓 신청
```
학생 → 티켓 신청 → 행사 관리
  → 행사 모집중인지 확인함
  → [모집중 아님] 티켓 신청 거부됨
  → 행사 정원이 초과되면 티켓 신청 생성 불가
  → 이미 신청한 학생인지 확인함
  → [이미 신청] 같은 학생은 같은 행사에 하나의 티켓만 신청 가능
  → 티켓 신청됨 → 티켓 코드 생성기 → 티켓 코드 발급됨
  → 행사 신청 가능 인원 감소됨
```

### 내 티켓 조회
```
학생 → 내 티켓 조회함 → 행사 관리
  → 이미 신청한 학생인지 확인함
  → 이미 신청한 학생만 티켓 조회 가능
  → 티켓 정보 출력함
```

### 티켓 취소
```
학생 → 티켓 취소함 → 행사 관리
  → 본인의 티켓인지 확인함
  → [본인 아님] 티켓 취소 거부됨
  → 행사 모집중인지 확인함
  → [모집중 아님] 모집중인 행사만 취소 가능
  → 이미 취소된 상태인지 확인
  → [이미 취소] 티켓 취소 거부됨
  → 완성(입장)된 티켓만 취소 가능
  → 행사 신청 가능 인원 증가함
```

### 입장 확인
```
입장 관리자 → 입장 시간 시작 → 입장 관리 시스템 → 입장 시작 알림 발송됨

입장 관리자 → 티켓 확인 요청 (입장) → 티켓 관리 시스템
  → 입장 관리자가 티켓 코드를 스캔/입력함
  → 유효 티켓 여부 확인 (취소표)
  → 입장 가능 사전 인지 확인
  → 행사장 내 여분 인원 초과 여부 확인
  → 입장 가능 상태로 변경됨
  → 입장 처리 완료됨
  → 학생이 입장됨
  → 행사장 내부 인원 갱신
  → 행사 인원 확인 시스템 → 행사장 내부 인원 수 갱신됨
  → 입장 시간 기록됨

입장 관리자 → 티켓 확인 요청 (퇴장)
  → 입장 관리자가 티켓 코드를 스캔/입력함
  → 퇴장 처리 완료됨
  → 학생이 퇴장됨
  → 행사장 내부 인원 갱신
  → 행사장 내부 인원 수 갱신됨

입장 관리자 → 티켓 확인 요청 (재입장)
  → 재입장이 가능한 행사 확인
  → 입장 관리자가 티켓 코드를 스캔/입력함
  → 입장 처리 완료됨
  → 학생이 입장됨
  → 행사장 내부 인원 갱신
  → 행사장 내부 인원 수 갱신됨
```

---

## 11. 에러 처리

| HTTP 코드 | 상황 |
|-----------|------|
| 400 | 필수 필드 누락, 잘못된 입력 |
| 403 | 권한 없음 (역할 불일치) |
| 404 | 행사/티켓 없음 |
| 409 | 중복 신청, 정원 초과, 이미 입장 처리됨 |
| 500 | 서버 내부 오류 |

---

## 12. 프로젝트 구조

```
/
├── frontend/                    # React 프론트엔드
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   └── App.jsx
│   └── package.json
├── backend/
│   ├── functions/               # Lambda 함수들
│   │   ├── events/
│   │   │   ├── createEvent.js
│   │   │   ├── getEvents.js
│   │   │   ├── getEvent.js
│   │   │   ├── updateEvent.js
│   │   │   └── updateEventStatus.js
│   │   ├── tickets/
│   │   │   ├── createTicket.js
│   │   │   ├── getMyTickets.js
│   │   │   └── cancelTicket.js
│   │   ├── admission/
│   │   │   ├── verifyTicket.js
│   │   │   └── processEntry.js
│   │   └── admin/
│   │       ├── getApplicants.js
│   │       ├── getEventStats.js
│   │       └── getDashboard.js
│   ├── lib/
│   │   ├── dynamodb.js          # DynamoDB 클라이언트
│   │   ├── response.js          # 공통 응답 헬퍼
│   │   └── auth.js              # 인증 헬퍼
│   ├── template.yaml            # SAM 템플릿
│   └── package.json
├── docs/
│   ├── implementation-spec.md   # 이 문서
│   └── quick-deploy.md          # 배포 가이드
└── README.md
```
