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
import { CHARACTERS, characterIdFor, characterSvg, readerTitle } from '../characters'
import { setCharacter } from '../lib/students'
import { realNameWarning } from '../lib/filter'
import { dustBalance, resolveStarStyle } from '../shop'
import { openShop } from './ShopModal'

export async function renderConstellation(container: HTMLElement): Promise<() => void> {
  if (!state.session) {
    navigate('/auth')
    return () => {}
  }

  container.innerHTML = `
    <div class="view">
      <div class="my-sky">
        <aside class="profile-card" id="profile-card"><p class="hint">불러오는 중...</p></aside>
        <section class="my-sky-main">
          <header class="my-sky-header">
            <h1>나의 별자리</h1>
            <p>책 속 문장이 모여, 나만의 우주가 돼요</p>
          </header>
          <div class="star-canvas-wrap" id="star-wrap">
            <button class="fab" id="add-book">✦ 책으로 별 만들기</button>
          </div>
        </section>
      </div>
    </div>
  `

  const wrap = container.querySelector<HTMLElement>('#star-wrap')!
  const hud = container.querySelector<HTMLElement>('#profile-card')!

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
    const style = resolveStarStyle(state.student!.starStyle)
    scene.setStars(currentBooks.map((book, i) => ({ book, position: positions[i], style })))

    const positionByBookId = new Map(currentBooks.map((book, i) => [book.id, positions[i]]))
    // 직접 이은 적이 없으면(starLines 없음) 템플릿 모양대로 기본 선을 보여준다. 빈 배열은 "선 없음"을 고른 것
    const lines = state.student!.starLines
      ?? defaultStarLines(state.student!.constellationTemplate, currentBooks.map((b) => b.id), positions)
    const connectionPairs = lines
      .map(({ a, b }) => [positionByBookId.get(a), positionByBookId.get(b)] as const)
      .filter((pair): pair is [import('three').Vector3, import('three').Vector3] => !!pair[0] && !!pair[1])
      .map(([a, b]) => [a, b, style.lineColor] as [import('three').Vector3, import('three').Vector3, number])
    scene.setConnections(connectionPairs)

    const student = state.student!
    hud.innerHTML = `
      <div class="profile-card-top">
        <span>내 프로필</span>
        <button id="edit-nickname" class="hud-icon-btn" title="닉네임 수정">✏️</button>
      </div>
      <div class="profile-character">${characterSvg(characterIdFor(student), 180)}</div>
      <div class="profile-name">${escapeHtml(student.nickname)}</div>
      <div class="profile-sub">${templateLabel(student.constellationTemplate)}</div>
      <span class="profile-title">${readerTitle(currentBooks.length)}</span>
      <div class="profile-stats">
        <div><span>별</span><strong>${currentBooks.length}개</strong></div>
        <div><span>별가루</span><strong title="모은 별가루 ${student.starDust}">${dustBalance(student)}</strong></div>
      </div>
      <button class="btn secondary profile-btn" id="change-character">캐릭터 바꾸기</button>
      <button class="btn profile-btn shop-btn" id="open-shop">🛍 별가루 상점</button>
      <div class="profile-actions">
        <button id="open-editor" class="hud-icon-btn">🪄 별자리 편집</button>
        <button id="toggle-3d" class="hud-icon-btn">${toggle3dButtonLabel()}</button>
      </div>
      <div class="profile-links">
        <a href="#/class">학급 성운 보기 →</a>
        <a href="#/board">게시판 →</a>
      </div>
    `
    hud.querySelector('#edit-nickname')!.addEventListener('click', openNicknameEditor)
    hud.querySelector('#change-character')!.addEventListener('click', openCharacterPicker)
    hud.querySelector('#open-shop')!.addEventListener('click', () => {
      openShop(state.student!, (next) => {
        state.student = next
        void refresh()
      })
    })
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

  function openCharacterPicker() {
    const current = characterIdFor(state.student!)
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    backdrop.innerHTML = `
      <div class="modal" style="width:min(560px,100%)">
        <h2>캐릭터 바꾸기</h2>
        <p class="hint">내 별자리와 학급 성운에서 나를 대신할 캐릭터를 골라요.</p>
        <div class="character-grid">
          ${CHARACTERS.map((c) => `
            <button type="button" class="character-option${c.id === current ? ' selected' : ''}" data-id="${c.id}">
              ${characterSvg(c.id, 96)}
              <span>${c.name}</span>
            </button>`).join('')}
        </div>
        <button type="button" class="btn secondary" id="character-close">닫기</button>
      </div>
    `
    document.body.appendChild(backdrop)
    const close = () => backdrop.remove()
    backdrop.querySelector('#character-close')!.addEventListener('click', close)
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
    backdrop.querySelectorAll<HTMLButtonElement>('.character-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await setCharacter(state.session!.classCode, state.session!.studentId, btn.dataset.id!)
        state.student!.character = btn.dataset.id!
        close()
        await refresh()
      })
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
        const warning = realNameWarning(input.value)
        if (warning && !confirm(warning)) return
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
