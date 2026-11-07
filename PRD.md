# 북두칠성 — PRD

> JUST BUILD 2026 · 팀 M3WE 원본 PRD(PDF)를 기반으로, **3시간 내 구현·배포**가 가능하도록 범위를 재조정한 실행용 PRD입니다.
> 원본 PRD의 사용자 가설·흐름·용어는 그대로 유지하되, "이번 빌드에서 하는 것"과 "다음 단계"를 명확히 분리했습니다.

## 1. 한 줄 요약

중고등학생이 읽은 책을 별로 모아 **개인 별자리**를 키우고, 책 제목·저자·별점은 필수로, 문장·읽은 계기·요약·느낀점·다시 읽음·탐구 질문 같은 선택 활동을 남길수록 별이 밝아지며, **학급 성운**에서 같은 반 친구들과 장르·문장으로 이어지는 3D 독서 기록 서비스.

- **사용자**: 독서 기록을 써야 하는 중고등학생 / 학급을 관리하는 교사
- **문제**: 독서 기록이 줄거리 요약에서 끝나고, 책끼리도 친구끼리도 연결되지 않아 다음 책으로 이어지는 동기가 없다.

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 | Vite + TypeScript (vanilla) | 빌드 속도·번들 최소화를 위해 프레임워크 없이 구현 |
| 3D 렌더링 | Three.js (`StarScene`, `OrbitControls`) | 별자리뷰·학급뷰 공용 엔진 |
| 인증 | Firebase Auth (Google) | **교사만** 구글 로그인. 학생은 학급코드+닉네임+PIN(비OAuth) |
| 데이터 | Firebase Firestore | `classes/{code}/students/{id}/books/{id}` |
| 배포 | GitHub Actions → GitHub Pages | `main` 푸시 시 자동 빌드·배포 |

## 3. 이번 빌드(3시간)에서 하는 것 — P0

1. **학생 입장**: 학급 코드(6자리) + 닉네임 + 숫자 4자리 PIN(연도 없이 월·일만 입력). 생일 월·일 입력 시 12궁 자동 지정(값 미저장), 또는 직접 선택. 입장 후에도 내 별자리 화면에서 닉네임을 다시 수정할 수 있음(같은 학급 내 중복 닉네임 불가).
2. **내 별자리 뷰 (핵심 기능 1)**: Three.js 3D 씬. 책 1권 = 별 1개. 제목·저자·별점만 있어도 별 생성(1단계), 선택 활동 종류 수에 따라 5단계까지 밝아짐. 큰 별(마음에 남은 책) 지정.
3. **책 등록(게시판)**: 제목·저자·별점 필수 + 문장/쪽수·읽은 계기·다시 읽음·요약·느낀점·탐구 질문 선택 입력. 같은 책 재등록 시 기존 별에 병합.
4. **학급 성운 뷰 (핵심 기능 2)**: 학급 전체 학생의 별을 한 화면에, 학생별로 군집 배치. 같은 문장(정규화 비교)을 남긴 학생끼리 연결선. 별가루 기준 주간 랭킹 Top 5(가명 표시).
5. **교사 관리자 페이지**: 구글 로그인 → 학급 코드 생성(QR 포함) → 학급 성운/랭킹 공개 토글 → **학생 명단 관리**(닉네임 수정, PIN 초기화, 삭제) → **OpenAI API 키 저장**(학급별, Cloud Functions 경유로만 사용).
6. **별가루(리워드)**: 활동별 차등 지급(README 참고), 하루 적립 상한(기본 30) 적용. 상한 도달 후에도 별은 계속 쌓임.
7. **GitHub Pages 배포**: Actions 워크플로우로 자동 빌드·배포.
8. **AI 장르·키워드 추정**: Cloud Function(`generateBookTags`)이 교사가 저장한 OpenAI 키로 실제 호출(배포 전/키 미설정 시 로컬 휴리스틱으로 자동 대체). 학급당 하루 호출 상한(200회)으로 비용 폭주 방지.
9. **데모 데이터**: 교사 관리자 페이지의 "데모 학급 만들기" 버튼으로 중2 수준 가상 학생 10명 + 책 18권을 즉시 생성(시연용).
10. **화면 전환 3D 효과**: 라우터 전환 시 이전/다음 화면이 `perspective` + `rotateY` + `translateZ`로 밀려나고 들어오는 3D 트랜지션 적용(`prefers-reduced-motion`이면 비활성화).

## 4. 이번에는 하지 않는 것 (원본 PRD 02탭과 동일 + 시간 제약으로 추가 축소)

원본에서 범위 제외:
- 실물 책갈피 인쇄, 노래·영화·웹툰 자동 수집, 학교 밖 공개 매칭/실제 은하 연결
- 실제 결제, 별자리 직접 꾸미기 고급 기능
- 생일 연도/전체 저장, 실명·학교명·연락처 수집
- 자유 댓글(정해진 응원 문구+하트까지만), 필사 사진 자동 판독

3시간 제약으로 **이번 빌드에서 추가로 미룸 (P1/P2, 이슈로 등록)**:
- 별가루 상점(모양/색상/윤곽 변경권 구매·적용)
- 한 소절 카드 생성·다운로드 (문구 버전 3종, 비율별 이미지)
- 필사 사진 업로드 (Firebase Storage 연동)
- 친구 별 응원 문구·하트, 교환 독서 미션
- 한 소절 카드용 AI 문구 생성(장르·키워드 추출은 이번에 Cloud Functions로 연동됨 — 아래 "AI 연동" 참고)
- 은하 뷰(여러 학급 비교), 안 읽은 장르 흐리게 표시 등 디테일
- 모바일 반응형 정밀 QA(320/390/768/1440px), 접근성(200% 확대, 동작 줄이기 설정)

## 5. 데이터 모델 (Firestore)

```
classes/{classCode}                 # 6자리 코드가 문서 ID
  name, teacherUid, nebulaVisible, rankingVisible,
  openaiKeyConfigured, openaiKeyUpdatedAt, createdAt

classes/{classCode}/secrets/openai  # 클라이언트 읽기 금지(쓰기 전용) — Cloud Functions만 Admin SDK로 읽음
  apiKey, updatedAt, dailyCallCount, lastCallDate

classes/{classCode}/students/{id}
  nickname, pinHash(sha256), zodiac, starDust, dailyEarned, lastEarnDate, createdAt

classes/{classCode}/students/{id}/books/{id}
  title, author, rating, classCode(비정규화 — collectionGroup 쿼리용),
  quote, quotePage, reason, rereadCount, summary, feeling, inquiryQuestion,
  isBigStar, bigStarReason, genre, genreIsAiGuess, keywords, createdAt
```

별 밝기(`computeBrightness`)는 저장하지 않고 책 문서에서 매번 계산합니다(선택 활동 채워진 개수 → 1~5단계).

## 6. AI 연동 아키텍처 (OpenAI 키 보안)

정적 사이트(GitHub Pages) + Firebase 구조에서 API 키를 클라이언트에 그대로 두면 학생이 개발자도구로
키를 빼낼 수 있어(원본 PRD 04탭 "키는 서버 환경 변수에" 요구사항과 충돌), 아래처럼 분리했습니다.

1. 교사가 관리자 페이지에서 키를 입력 → `classes/{code}/secrets/openai` 문서에 저장.
2. 이 문서는 Firestore 규칙상 **클라이언트는 읽기 자체가 불가능**(쓰기만 가능, 교사 본인도 재조회 불가).
3. 학생이 책을 등록하면 클라이언트는 `generateBookTags` Cloud Function을 호출(인증 없이도 호출 가능 — 학생은 Firebase Auth가 없으므로).
4. Function은 Admin SDK로 키를 읽어 OpenAI를 직접 호출하고 결과(장르·키워드)만 클라이언트에 반환. 키는 응답에 절대 포함되지 않음.
5. 학급당 하루 호출 200회 상한을 Function 안에서 강제(비용 폭주 방지).
6. Cloud Functions는 외부 네트워크 호출을 위해 **Firebase Blaze(종량제) 요금제**가 필요. 올라마(Ollama)는 사설 서버라 이 구조로 안전하게 노출하기 어려워 이번 범위에서 제외.
7. Functions 미배포 상태에서는 호출이 실패해도 화면이 멈추지 않고 로컬 휴리스틱(`src/lib/genre.ts`)으로 조용히 대체됨. 배포 방법은 README.md "AI 기능 연결하기" 참고.

## 7. 별가루 지급표 (초안, 원본 PRD 03탭 기준)

등록(제목+저자+별점) 7 · 문장 3 · 읽은 계기 4 · 다시 읽음 5 · 요약 6 · 느낀점 6 · 탐구질문 6 · 필사사진 8(미구현) · 응원 3(미구현) · 하트 1(미구현). 하루 상한 30(KST 자정 기준).

## 8. 알려진 한계 (문서화된 기술 부채)

- **학생 인증**: Firebase Auth를 쓰지 않으므로 Firestore 보안 규칙만으로는 "PIN을 아는 사람 = 본인"을 완전히 보장하지 못함. 필드 유효성 검증만 적용(`firestore.rules`). 다음 단계로 Cloud Functions 기반 PIN 검증 + 커스텀 토큰 발급 전환 권장.
- **AI 호출 비용**: Cloud Function이 학급당 하루 200회로 상한을 두지만, 악의적 반복 호출(책 제목만 바꿔 반복 등)까지 완전히 막지는 못함 — 교사가 키를 직접 관리하고 필요시 삭제할 수 있도록 함.
- **주간 랭킹**: "주간" 집계 로직 없이 누적 `starDust`로 임시 대체. 주 단위 리셋/집계는 다음 단계.
- **필사 사진**: 업로드 UI·Storage 연동 없음.
- **교사 계정 다중 관리**: 현재는 학급을 만든 구글 계정(`teacherUid`) 1명만 해당 학급을 관리 가능. 공동 담임 등 다중 교사 권한 공유는 다음 단계.

## 9. 우선순위별 작업 (GitHub 이슈로 추적)

- **P0 (3시간 내 완료 목표)**: 프로젝트 스캐폴드, Firebase 연동, 학생 입장, 책 등록, 내 별자리뷰, 학급 성운뷰, 교사 화면, 별가루 적립, GitHub Pages 배포
- **P0.5 (2차 업데이트)**: 실 Firebase 프로젝트 연동, 닉네임 수정, 교사 관리자 페이지 확장(학생 명단 CRUD, OpenAI 키 저장), Cloud Functions 기반 AI 연동, 중2 수준 데모 데이터, 화면 전환 3D 효과
- **P1 (다음 스프린트)**: 별가루 상점, 한 소절 카드(+AI 문구 생성), 필사 사진 업로드, 친구 응원/하트
- **P2 (추후)**: 주간 랭킹 정식 집계, 은하 뷰, 접근성/반응형 정밀 QA, 공동 교사 권한 관리

각 항목은 GitHub 저장소의 Issues에 라벨(`P0`/`P1`/`P2`)과 함께 등록되어 있습니다.
