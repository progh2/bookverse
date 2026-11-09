import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  type User, type AuthError,
} from 'firebase/auth'
import { auth, googleProvider, firebaseConfigured } from '../firebase'
import { createClass, setClassVisibility, saveOpenAiKey, clearOpenAiKey } from '../lib/classes'
import { listStudents, deleteStudent } from '../lib/students'
import { getAccount, renameAccount, resetAccountPin } from '../lib/accounts'
import { seedDemoClass } from '../lib/seed'
import { deleteBook, listClassBooks } from '../lib/books'
import { openBookPost } from './BookPostModal'
import { toMillis } from '../lib/time'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { ClassRoom, Student } from '../types'

export function renderTeacher(container: HTMLElement): () => void {
  container.innerHTML = `<div class="view"><div class="panel" id="teacher-panel"><p>불러오는 중...</p></div></div>`
  const panel = container.querySelector<HTMLElement>('#teacher-panel')!

  if (!firebaseConfigured) {
    panel.innerHTML = `
      <h1>🏫 교사 관리자 화면</h1>
      <p class="hint">Firebase 설정이 아직 연결되지 않았어요. README의 안내대로 .env.local을 채운 뒤 다시 실행해 주세요.</p>
    `
    return () => {}
  }

  // 리다이렉트 방식 로그인으로 돌아온 경우 결과(또는 에러)를 먼저 확인한다.
  let redirectError: string | null = null
  getRedirectResult(auth).catch((err) => {
    redirectError = describeAuthError(err)
  })

  const unsub = onAuthStateChanged(auth, (user) => renderPanel(panel, user, redirectError))
  return () => unsub()
}

async function renderPanel(panel: HTMLElement, user: User | null, initialError: string | null = null) {
  if (!user) {
    panel.innerHTML = `
      <h1>🏫 교사 로그인</h1>
      <p class="hint">구글 계정으로 로그인하면 학급 코드를 만들고 관리할 수 있어요.</p>
      <button class="btn" id="google-login">구글로 로그인</button>
      <p class="error-text" id="login-error">${initialError ? escapeHtml(initialError) : ''}</p>
    `
    const loginBtn = panel.querySelector<HTMLButtonElement>('#google-login')!
    const errorEl = panel.querySelector<HTMLElement>('#login-error')!
    loginBtn.addEventListener('click', async () => {
      errorEl.textContent = ''
      loginBtn.disabled = true
      try {
        await signInWithPopup(auth, googleProvider)
      } catch (err) {
        const code = (err as AuthError)?.code
        // 팝업이 막히거나 자동화 브라우저로 인식돼 막히면 리다이렉트 방식으로 재시도
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleProvider)
          return
        }
        errorEl.textContent = describeAuthError(err)
        loginBtn.disabled = false
      }
    })
    return
  }

  panel.innerHTML = `
    <h1>🏫 ${escapeHtml(user.displayName ?? '교사')}님의 관리자 페이지</h1>
    <button class="btn secondary" id="logout" style="width:auto">로그아웃</button>

    <div style="margin-top:24px">
      <label for="class-name">새 학급 이름</label>
      <input id="class-name" placeholder="예: 3학년 2반" />
      <div style="display:flex; gap:10px; margin-top:12px">
        <button class="btn" id="create-class" style="margin-top:0">학급 코드 만들기</button>
        <button class="btn secondary" id="create-demo" style="margin-top:0">데모 학급 만들기</button>
      </div>
      <p class="hint">데모 학급은 중2 수준의 가상 학생 10명과 책 데이터를 바로 채워줘요(시연용).</p>
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

  panel.querySelector('#create-demo')!.addEventListener('click', async () => {
    const btn = panel.querySelector<HTMLButtonElement>('#create-demo')!
    btn.disabled = true
    btn.textContent = '데모 데이터 만드는 중...'
    try {
      const code = await seedDemoClass(user.uid)
      await loadClasses(panel, user.uid)
      alert(`데모 학급이 만들어졌어요! 학급 코드: ${code}`)
    } catch (err) {
      alert(`데모 학급 생성 실패: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      btn.disabled = false
      btn.textContent = '데모 학급 만들기'
    }
  })

  await loadClasses(panel, user.uid)
}

async function loadClasses(panel: HTMLElement, uid: string) {
  const listEl = panel.querySelector<HTMLElement>('#class-list')!
  listEl.innerHTML = '<p class="hint">학급 불러오는 중...</p>'

  let classes: ClassRoom[]
  try {
    const q = query(collection(db, 'classes'), where('teacherUid', '==', uid))
    const snap = await getDocs(q)
    classes = snap.docs.map((d) => d.data() as ClassRoom)
  } catch (err) {
    listEl.innerHTML = `<p class="error-text">학급 목록을 불러오지 못했어요: ${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`
    return
  }

  if (classes.length === 0) {
    listEl.innerHTML = '<p class="hint">아직 만든 학급이 없어요.</p>'
    return
  }

  const rosters = await Promise.all(classes.map((c) => listStudents(c.code)))

  listEl.innerHTML = classes
    .map((c, i) => renderClassCard(c, rosters[i]))
    .join('')

  classes.forEach((c, i) => wireClassCard(listEl, c, rosters[i], uid, () => loadClasses(panel, uid)))
}

function renderClassCard(c: ClassRoom, students: Student[]): string {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    location.origin + location.pathname + '#/auth',
  )}`
  return `
    <div class="book-row" style="flex-direction:column; align-items:flex-start; gap:10px" data-class="${c.code}">
      <div style="display:flex; justify-content:space-between; width:100%">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="badge">코드 ${c.code}</span>
      </div>
      <img src="${qrUrl}" width="100" height="100" alt="QR" />
      <p class="hint">학생은 QR로 접속해 로그인/회원가입한 뒤, 학급 코드 <strong>${c.code}</strong>를 입력해 들어와요.</p>

      <label style="margin:0"><input type="checkbox" data-field="nebulaVisible" ${c.nebulaVisible ? 'checked' : ''} class="field-toggle" style="width:auto;display:inline-block;margin-right:6px" />학급 성운 공개</label>
      <label style="margin:0"><input type="checkbox" data-field="rankingVisible" ${c.rankingVisible ? 'checked' : ''} class="field-toggle" style="width:auto;display:inline-block;margin-right:6px" />주간 랭킹 공개</label>

      <details style="width:100%">
        <summary style="cursor:pointer">🤖 AI 설정 (ChatGPT API 키) ${c.openaiKeyConfigured ? '<span class="badge">설정됨</span>' : ''}</summary>
        <div style="margin-top:10px">
          <p class="hint">키는 저장 후 다시 조회할 수 없어요(보안). 다시 설정하려면 새로 입력해 덮어쓰세요. 실제 호출은 서버(Cloud Functions)에서만 이뤄지고 학생 화면에는 절대 노출되지 않아요.</p>
          <input type="password" class="ai-key-input" placeholder="sk-..." autocomplete="off" />
          <div style="display:flex; gap:10px; margin-top:10px">
            <button type="button" class="btn ai-key-save" style="margin-top:0">키 저장</button>
            <button type="button" class="btn secondary ai-key-clear" style="margin-top:0">키 삭제</button>
          </div>
          <p class="error-text ai-key-msg"></p>
        </div>
      </details>

      <details style="width:100%">
        <summary style="cursor:pointer">👥 학생 명단 (${students.length}명)</summary>
        <div style="margin-top:10px" class="roster">
          ${students.length === 0 ? '<p class="hint">아직 입장한 학생이 없어요.</p>' : students.map((s) => `
            <div class="book-row" data-student="${s.id}">
              <div>
                <strong class="roster-nickname">${escapeHtml(s.nickname)}</strong>
                <span class="hint">별가루 ${s.starDust}✨</span>
              </div>
              <div style="display:flex; gap:6px">
                <button type="button" class="btn secondary roster-rename" style="width:auto; margin-top:0; padding:6px 10px; font-size:13px">닉네임 수정</button>
                <button type="button" class="btn secondary roster-reset-pin" style="width:auto; margin-top:0; padding:6px 10px; font-size:13px">PIN 초기화</button>
                <button type="button" class="btn secondary roster-delete" style="width:auto; margin-top:0; padding:6px 10px; font-size:13px; color:#ff8a8a">삭제</button>
              </div>
            </div>
          `).join('')}
        </div>
      </details>

      <details style="width:100%" class="book-admin">
        <summary style="cursor:pointer">📚 책·기록 관리 (개별 삭제)</summary>
        <div style="margin-top:10px" class="book-admin-body"><p class="hint">펼치면 불러와요.</p></div>
      </details>
    </div>
  `
}

/** 학급의 모든 책을 최신순으로 보여주고, 열어서 기록을 하나씩 지우거나 책 자체를 지울 수 있게 한다. */
async function loadBookAdmin(body: HTMLElement, c: ClassRoom, students: Student[], uid: string) {
  body.innerHTML = '<p class="hint">책 불러오는 중...</p>'
  const books = (await listClassBooks(c.code)).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  const nick = (id: string) => students.find((s) => s.id === id)?.nickname ?? '(명단에 없음)'
  const filterInput = '<input class="book-admin-filter" placeholder="제목·닉네임으로 찾기" style="margin-bottom:8px" />'
  const rows = (list: typeof books) => list.map((b) => {
    const count = Object.values(b.entryCounts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0)
    return `
      <div class="book-row" data-book="${b.id}">
        <div><strong>${escapeHtml(b.title)}</strong> <span class="hint">${escapeHtml(nick(b.studentId))} · 기록 ${count}개</span></div>
        <div style="display:flex; gap:6px">
          <button type="button" class="btn secondary book-admin-open" style="width:auto; margin-top:0; padding:6px 10px; font-size:13px">열기(기록 삭제)</button>
          <button type="button" class="btn secondary book-admin-delete" style="width:auto; margin-top:0; padding:6px 10px; font-size:13px; color:#ff8a8a">책 삭제</button>
        </div>
      </div>`
  }).join('') || '<p class="hint">책이 없어요.</p>'

  body.innerHTML = `
    <p class="hint">책 ${books.length}권. 부적절한 기록은 책을 열어 🗑로 하나씩, 책 전체는 '책 삭제'로 지워요.</p>
    ${filterInput}<div class="book-admin-list">${rows(books)}</div>`
  const listEl = body.querySelector<HTMLElement>('.book-admin-list')!
  const wireRows = (list: typeof books) => {
    list.forEach((b) => {
      const row = listEl.querySelector<HTMLElement>(`[data-book="${b.id}"]`)
      if (!row) return
      row.querySelector('.book-admin-open')!.addEventListener('click', () => {
        openBookPost(b, {
          authorNickname: nick(b.studentId),
          viewer: { classCode: c.code, studentId: `teacher-${uid}`, nickname: '선생님' },
          onChanged: () => void loadBookAdmin(body, c, students, uid),
        })
      })
      row.querySelector('.book-admin-delete')!.addEventListener('click', async () => {
        if (!confirm(`${nick(b.studentId)} 학생의 『${b.title}』와 달린 기록을 모두 지울까요? 되돌릴 수 없어요.`)) return
        await deleteBook(b)
        row.remove()
      })
    })
  }
  wireRows(books)
  body.querySelector<HTMLInputElement>('.book-admin-filter')!.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.trim().toLowerCase()
    const list = books.filter((b) => !q || b.title.toLowerCase().includes(q) || nick(b.studentId).toLowerCase().includes(q))
    listEl.innerHTML = rows(list)
    wireRows(list)
  })
}

function wireClassCard(listEl: HTMLElement, c: ClassRoom, students: Student[], uid: string, reload: () => void) {
  const card = listEl.querySelector<HTMLElement>(`[data-class="${c.code}"]`)
  if (!card) return

  const bookAdmin = card.querySelector<HTMLDetailsElement>('.book-admin')!
  let bookAdminLoaded = false
  bookAdmin.addEventListener('toggle', () => {
    if (!bookAdmin.open || bookAdminLoaded) return
    bookAdminLoaded = true
    void loadBookAdmin(card.querySelector<HTMLElement>('.book-admin-body')!, c, students, uid)
  })

  card.querySelectorAll<HTMLInputElement>('.field-toggle').forEach((cb) => {
    cb.addEventListener('change', () => {
      const field = cb.dataset.field as 'nebulaVisible' | 'rankingVisible'
      setClassVisibility(c.code, { [field]: cb.checked })
    })
  })

  const keyInput = card.querySelector<HTMLInputElement>('.ai-key-input')!
  const keyMsg = card.querySelector<HTMLElement>('.ai-key-msg')!
  card.querySelector('.ai-key-save')!.addEventListener('click', async () => {
    const key = keyInput.value.trim()
    if (!key) { keyMsg.textContent = 'API 키를 입력해 주세요.'; return }
    try {
      await saveOpenAiKey(c.code, key)
      keyInput.value = ''
      keyMsg.style.color = ''
      keyMsg.textContent = '저장됐어요. (Cloud Functions 배포가 완료돼야 실제 AI 호출에 쓰입니다)'
    } catch (err) {
      keyMsg.textContent = err instanceof Error ? err.message : String(err)
    }
  })
  card.querySelector('.ai-key-clear')!.addEventListener('click', async () => {
    await clearOpenAiKey(c.code)
    keyMsg.textContent = '키를 삭제했어요.'
    reload()
  })

  students.forEach((s) => {
    const row = card.querySelector<HTMLElement>(`[data-student="${s.id}"]`)
    if (!row) return

    row.querySelector('.roster-rename')!.addEventListener('click', async () => {
      const next = prompt('새 닉네임 (이 학생의 다른 학급에도 함께 반영돼요)', s.nickname)
      if (!next || next.trim() === s.nickname) return
      try {
        const account = await getAccount(s.id)
        await renameAccount(s.id, next, account?.classCodes ?? [c.code])
        reload()
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err))
      }
    })

    row.querySelector('.roster-reset-pin')!.addEventListener('click', async () => {
      if (!confirm(`${s.nickname} 학생의 비밀번호(계정 전체)를 초기화할까요?`)) return
      const newPin = await resetAccountPin(s.id)
      alert(`새 비밀번호: ${newPin}\n학생에게 알려주세요.`)
    })

    row.querySelector('.roster-delete')!.addEventListener('click', async () => {
      if (!confirm(`${s.nickname} 학생과 등록한 책을 모두 삭제할까요? 되돌릴 수 없어요.`)) return
      await deleteStudent(c.code, s.id)
      reload()
    })
  })
}

function describeAuthError(err: unknown): string {
  const code = (err as AuthError)?.code
  switch (code) {
    case 'auth/unauthorized-domain':
      return '이 사이트 주소가 Firebase 승인된 도메인 목록에 없어요. 콘솔 > Authentication > Settings > 승인된 도메인에 추가해 주세요.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '로그인 창이 완료되기 전에 닫혔어요. 다시 시도해 주세요.'
    case 'auth/network-request-failed':
      return '네트워크 오류로 로그인에 실패했어요. 연결을 확인하고 다시 시도해 주세요.'
    default:
      return err instanceof Error ? `로그인 실패: ${err.message}` : '로그인에 실패했어요. 다시 시도해 주세요.'
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
