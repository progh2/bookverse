# ⭐ Book두칠성

읽은 책을 별로 모아 3D 별자리로 키우는 독서 기록 서비스. JUST BUILD 2026 팀 M3WE PRD 기반. 상세 기획은 [PRD.md](./PRD.md) 참고.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 아래 'Firebase 설정' 참고해서 값 채우기
npm run dev
```

## Firebase 설정 (처음 한 번)

1. https://console.firebase.google.com 에서 새 프로젝트 생성
2. **Authentication** → 로그인 방법 → **Google** 활성화 (교사 로그인용)
3. **Firestore Database** → 테스트 모드 또는 아래 `firestore.rules`로 생성
   - Firebase CLI가 있다면: `firebase deploy --only firestore:rules,firestore:indexes`
   - 없다면 콘솔에서 `firestore.rules` 내용을 그대로 붙여넣기
4. 프로젝트 설정 → 일반 → "내 앱" → 웹 앱 추가 → `firebaseConfig` 값을 `.env.local`에 복사
5. GitHub Pages 배포용으로는 저장소 **Settings → Secrets and variables → Actions**에 동일한 값을
   `VITE_FIREBASE_API_KEY` 등의 이름으로 등록해야 배포 빌드에도 반영됩니다.

Firebase 설정 전에도 앱은 실행되지만(placeholder config), 로그인·저장 기능은 동작하지 않습니다.

## AI 기능(장르·키워드 자동 추정) 연결하기

교사 관리자 페이지(`#/teacher`)에서 학급별로 ChatGPT(OpenAI) API 키를 저장할 수 있습니다. 키는
Firestore의 "쓰기 전용" 문서(`classes/{code}/secrets/openai`)에 들어가고 클라이언트는 절대 다시
읽을 수 없습니다 — 실제 OpenAI 호출은 Cloud Function(`functions/`)이 서버 쪽에서만 수행합니다.

**Cloud Functions를 배포해야 실제로 동작합니다** (배포 전에는 자동으로 로컬 휴리스틱 추정으로 대체됩니다):

```bash
npm install -g firebase-tools   # 최초 1회
firebase login                  # 브라우저로 구글 로그인
firebase deploy --only firestore:rules,firestore:indexes,functions
```

- Cloud Functions가 OpenAI(외부 API)를 호출하려면 Firebase **Blaze(종량제) 요금제**가 필요합니다(Spark 무료 플랜은 외부 네트워크 호출 불가).
- 올라마(Ollama)는 로컬/사설 서버라 정적 사이트+서버리스 구조에서 안전하게 호출하기 어려워 이번 범위에서는 제외했습니다.
- 학급당 하루 AI 호출 상한(기본 200회)을 Cloud Function 안에서 강제해 비용 폭주를 막습니다.

## 배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 자동으로 빌드 후 GitHub Pages에 배포합니다.
배포 주소: https://progh2.github.io/bookverse/

## 기술 스택

Vite + TypeScript + Three.js(3D 별자리/성운 뷰) + Firebase(Auth + Firestore)

## 알려진 한계

PRD.md의 "알려진 한계" 섹션 참고 (학생 인증 방식, AI 미연결, 주간 랭킹 임시 구현 등).
