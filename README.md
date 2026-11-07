# ⭐ 밑줄 별자리 (BookVerse)

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

## 배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 자동으로 빌드 후 GitHub Pages에 배포합니다.
배포 주소: https://progh2.github.io/bookverse/

## 기술 스택

Vite + TypeScript + Three.js(3D 별자리/성운 뷰) + Firebase(Auth + Firestore)

## 알려진 한계

PRD.md의 "알려진 한계" 섹션 참고 (학생 인증 방식, AI 미연결, 주간 랭킹 임시 구현 등).
