import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider, firebaseConfigured } from '../firebase'
import { createClass, setClassVisibility } from '../lib/classes'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { ClassRoom } from '../types'

export function renderTeacher(container: HTMLElement): () => void {
  container.innerHTML = `<div class="view"><div class="panel" id="teacher-panel"><p>불러오는 중...</p></div></div>`
  const panel = container.querySelector<HTMLElement>('#teacher-panel')!

  if (!firebaseConfigured) {
    panel.innerHTML = `
      <h1>🏫 교사 화면</h1>
      <p class="hint">Firebase 설정이 아직 연결되지 않았어요. README의 안내대로 .env.local을 채운 뒤 다시 실행해 주세요.</p>
    `
    return () => {}
  }

  const unsub = onAuthStateChanged(auth, (user) => renderPanel(panel, user))
  return () => unsub()
}

async function renderPanel(panel: HTMLElement, user: User | null) {
  if (!user) {
    panel.innerHTML = `
      <h1>🏫 교사 로그인</h1>
      <p class="hint">구글 계정으로 로그인하면 학급 코드를 만들고 관리할 수 있어요.</p>
      <button class="btn" id="google-login">구글로 로그인</button>
    `
    panel.querySelector('#google-login')!.addEventListener('click', () => signInWithPopup(auth, googleProvider))
    return
  }

  panel.innerHTML = `
    <h1>🏫 ${user.displayName ?? '교사'}님의 학급</h1>
    <button class="btn secondary" id="logout" style="width:auto">로그아웃</button>

    <div style="margin-top:24px">
      <label for="class-name">새 학급 이름</label>
      <input id="class-name" placeholder="예: 3학년 2반" />
      <button class="btn" id="create-class">학급 코드 만들기</button>
    </div>

    <div id="class-list" style="margin-top:24px"></div>
  `

  panel.querySelector('#logout')!.addEventListener('click', () => signOut(auth))

  panel.querySelector('#create-class')!.addEventListener('click', async () => {
    const nameInput = panel.querySelector<HTMLInputElement>('#class-name')!
    const name = nameInput.value.trim() || '우리 학급'
    const btn = panel.querySelector<HTMLButtonElement>('#create-class')!
    btn.disabled = true
    try {
      await createClass(user.uid, name)
      nameInput.value = ''
      await loadClasses(panel, user.uid)
    } finally {
      btn.disabled = false
    }
  })

  await loadClasses(panel, user.uid)
}

async function loadClasses(panel: HTMLElement, uid: string) {
  const listEl = panel.querySelector<HTMLElement>('#class-list')!
  listEl.innerHTML = '<p class="hint">학급 불러오는 중...</p>'

  const q = query(collection(db, 'classes'), where('teacherUid', '==', uid))
  const snap = await getDocs(q)
  const classes = snap.docs.map((d) => d.data() as ClassRoom)

  if (classes.length === 0) {
    listEl.innerHTML = '<p class="hint">아직 만든 학급이 없어요.</p>'
    return
  }

  listEl.innerHTML = classes
    .map(
      (c) => `
      <div class="book-row" style="flex-direction:column; align-items:flex-start; gap:8px">
        <div style="display:flex; justify-content:space-between; width:100%">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="badge">코드 ${c.code}</span>
        </div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(location.origin + location.pathname + '#/join?code=' + c.code)}" width="100" height="100" alt="QR" />
        <label style="margin:0"><input type="checkbox" data-code="${c.code}" data-field="nebulaVisible" ${c.nebulaVisible ? 'checked' : ''} style="width:auto;display:inline-block;margin-right:6px" />학급 성운 공개</label>
        <label style="margin:0"><input type="checkbox" data-code="${c.code}" data-field="rankingVisible" ${c.rankingVisible ? 'checked' : ''} style="width:auto;display:inline-block;margin-right:6px" />주간 랭킹 공개</label>
      </div>
    `,
    )
    .join('')

  listEl.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const code = cb.dataset.code!
      const field = cb.dataset.field as 'nebulaVisible' | 'rankingVisible'
      setClassVisibility(code, { [field]: cb.checked })
    })
  })
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
