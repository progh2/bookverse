import { StarScene } from '../three/StarScene'
import { defaultStarLines, layoutStars, templateLabel } from '../three/constellationLayout'
import { listBooks } from '../lib/books'
import { getStudent } from '../lib/students'
import { getAccount, renameAccount } from '../lib/accounts'
import { state } from '../state'
import { navigate } from '../router'
import { openBookForm } from './BookFormModal'
import { openBookPost } from './BookPostModal'
import { openConstellationEditor } from './ConstellationEditor'
import type { Book } from '../types'
import { saveSession } from '../lib/session'

export async function renderConstellation(container: HTMLElement): Promise<() => void> {
  if (!state.session) {
    navigate('/auth')
    return () => {}
  }

  container.innerHTML = `
    <div class="view">
      <div class="star-canvas-wrap" id="star-wrap">
        <div class="hud" id="hud">불러오는 중...</div>
        <button class="fab" id="add-book">+ 책으로 별 만들기</button>
      </div>
    </div>
  `

  const wrap = container.querySelector<HTMLElement>('#star-wrap')!
  const hud = container.querySelector<HTMLElement>('#hud')!

  if (!state.student) {
    state.student = await getStudent(state.session.classCode, state.session.studentId)
  }
  if (!state.student) {
    navigate('/classes')
    return () => {}
  }

  const scene = new StarScene(wrap, {
    onStarClick: (book) => showBookDetail(book),
    cameraPosition: [0, 0.3, 9], // 별자리 모양이 한눈에 들어오도록 가까이서 정면으로
  })

  let currentBooks: Book[] = []
  let rotationLocked = true

  function toggle3dButtonLabel(): string {
    return rotationLocked ? '🌀 3D로 보기' : '🔒 고정 보기'
  }

  async function refresh() {
    currentBooks = await listBooks(state.session!.classCode, state.session!.studentId)
    const customPositions = currentBooks.map((b) => state.student!.starPositions?.[b.id])
    const positions = layoutStars(state.student!.constellationTemplate, currentBooks.length, customPositions)
    scene.setStars(currentBooks.map((book, i) => ({ book, position: positions[i] })))

    const positionByBookId = new Map(currentBooks.map((book, i) => [book.id, positions[i]]))
    // 직접 이은 적이 없으면(starLines 없음) 템플릿 모양대로 기본 선을 보여준다. 빈 배열은 "선 없음"을 고른 것
    const lines = state.student!.starLines
      ?? defaultStarLines(state.student!.constellationTemplate, currentBooks.map((b) => b.id), positions)
    const connectionPairs = lines
      .map(({ a, b }) => [positionByBookId.get(a), positionByBookId.get(b)] as const)
      .filter((pair): pair is [import('three').Vector3, import('three').Vector3] => !!pair[0] && !!pair[1])
    scene.setConnections(connectionPairs)

    hud.innerHTML = `
      <div><strong>${escapeHtml(state.student!.nickname)}</strong>님의 별자리 (${templateLabel(state.student!.constellationTemplate)})
        <button id="edit-nickname" class="hud-icon-btn" title="닉네임 수정">✏️</button>
      </div>
      <div>별 ${currentBooks.length}개 · 별가루 <span class="dust">${state.student!.starDust}✨</span></div>
      <div style="margin-top:4px; display:flex; gap:10px; flex-wrap:wrap">
        <a href="#/class" style="color:var(--line-blue)">학급 성운 보기 →</a>
        <a href="#/board" style="color:var(--line-blue)">게시판 →</a>
        <button id="open-editor" class="hud-icon-btn" style="text-decoration:underline">🪄 별자리 편집</button>
        <button id="toggle-3d" class="hud-icon-btn" style="text-decoration:underline">${toggle3dButtonLabel()}</button>
      </div>
    `
    hud.querySelector('#edit-nickname')!.addEventListener('click', openNicknameEditor)
    hud.querySelector('#open-editor')!.addEventListener('click', () => {
      openConstellationEditor(state.session!.classCode, state.session!.studentId, state.student!, currentBooks, async () => {
        state.student = await getStudent(state.session!.classCode, state.session!.studentId)
        await refresh()
      })
    })
    hud.querySelector('#toggle-3d')!.addEventListener('click', () => {
      rotationLocked = !rotationLocked
      scene.setRotationLocked(rotationLocked)
      const btn = hud.querySelector('#toggle-3d')
      if (btn) btn.textContent = toggle3dButtonLabel()
    })
  }

  function openNicknameEditor() {
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    backdrop.innerHTML = `
      <form class="modal" id="nickname-form" style="width:min(340px,100%)">
        <h2>닉네임 수정</h2>
        <p class="hint">닉네임은 계정 전체(모든 학급)에서 공통으로 쓰여요.</p>
        <label for="new-nickname">새 닉네임</label>
        <input id="new-nickname" maxlength="12" value="${escapeHtml(state.student!.nickname)}" required />
        <div style="display:flex; gap:10px; margin-top:20px">
          <button type="button" class="btn secondary" id="nickname-cancel">취소</button>
          <button type="submit" class="btn">저장</button>
        </div>
        <p class="error-text" id="nickname-error"></p>
      </form>
    `
    document.body.appendChild(backdrop)
    const close = () => backdrop.remove()
    backdrop.querySelector('#nickname-cancel')!.addEventListener('click', close)
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })

    backdrop.querySelector('#nickname-form')!.addEventListener('submit', async (e) => {
      e.preventDefault()
      const errorEl = backdrop.querySelector<HTMLElement>('#nickname-error')!
      const input = backdrop.querySelector<HTMLInputElement>('#new-nickname')!
      try {
        const account = await getAccount(state.session!.studentId)
        await renameAccount(state.session!.studentId, input.value, account?.classCodes ?? [state.session!.classCode])
        const newNickname = input.value.trim()
        state.student!.nickname = newNickname
        state.session!.nickname = newNickname
        if (state.account) state.account.nickname = newNickname
        saveSession(state.session!)
        close()
        await refresh()
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err)
      }
    })
  }

  async function reloadStudentAndStars() {
    state.student = await getStudent(state.session!.classCode, state.session!.studentId)
    await refresh()
  }

  function showBookDetail(book: Book) {
    openBookPost(book, {
      authorNickname: state.student!.nickname,
      viewer: state.session!,
      onChanged: reloadStudentAndStars,
    })
  }

  container.querySelector('#add-book')!.addEventListener('click', () => {
    openBookForm(state.session!.classCode, state.session!.studentId, async (book) => {
      await reloadStudentAndStars()
      // 별을 만든 직후 바로 문장·느낀점 같은 기록을 더할 수 있게 상세 화면을 연다
      showBookDetail(book)
    })
  })

  await refresh()

  return () => scene.dispose()
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
