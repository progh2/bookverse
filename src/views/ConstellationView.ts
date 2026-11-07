import { StarScene } from '../three/StarScene'
import { layoutStars } from '../three/constellationLayout'
import { listBooks } from '../lib/books'
import { getStudent } from '../lib/students'
import { state } from '../state'
import { navigate } from '../router'
import { openBookForm } from './BookFormModal'
import { computeBrightness, type Book } from '../types'
import { zodiacNameKo } from '../lib/zodiac'

export async function renderConstellation(container: HTMLElement): Promise<() => void> {
  if (!state.session) {
    navigate('/join')
    return () => {}
  }

  container.innerHTML = `
    <div class="view">
      <div class="star-canvas-wrap" id="star-wrap">
        <div class="hud" id="hud">불러오는 중...</div>
        <button class="fab" id="add-book">+ 책 등록</button>
      </div>
    </div>
  `

  const wrap = container.querySelector<HTMLElement>('#star-wrap')!
  const hud = container.querySelector<HTMLElement>('#hud')!

  if (!state.student) {
    state.student = await getStudent(state.session.classCode, state.session.studentId)
  }
  if (!state.student) {
    navigate('/join')
    return () => {}
  }

  const scene = new StarScene(wrap, {
    onStarClick: (book) => showBookDetail(book),
  })

  async function refresh() {
    const books = await listBooks(state.session!.classCode, state.session!.studentId)
    const positions = layoutStars(state.student!.zodiac, books.length)
    scene.setStars(books.map((book, i) => ({ book, position: positions[i] })))

    const zodiacLabel = state.student!.zodiac ? zodiacNameKo(state.student!.zodiac) : '기본'
    hud.innerHTML = `
      <div><strong>${state.student!.nickname}</strong>님의 별자리 (${zodiacLabel})</div>
      <div>별 ${books.length}개 · 별가루 <span class="dust">${state.student!.starDust}✨</span></div>
      <div style="margin-top:4px"><a href="#/class" style="color:var(--line-blue)">학급 성운 보기 →</a></div>
    `
  }

  function showBookDetail(book: Book) {
    const brightness = computeBrightness(book)
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    backdrop.innerHTML = `
      <div class="modal">
        <h2>${book.isBigStar ? '🌟' : '⭐'} ${escapeHtml(book.title)}</h2>
        <p class="hint">${escapeHtml(book.author)} · 밝기 ${brightness}/5 · ${'★'.repeat(book.rating)}</p>
        ${book.quote ? `<p>"${escapeHtml(book.quote)}"${book.quotePage ? ` (${escapeHtml(book.quotePage)}쪽)` : ''}</p>` : ''}
        ${book.reason ? `<p><strong>읽은 계기</strong><br/>${escapeHtml(book.reason)}</p>` : ''}
        ${book.summary ? `<p><strong>요약</strong><br/>${escapeHtml(book.summary)}</p>` : ''}
        ${book.feeling ? `<p><strong>느낀점</strong><br/>${escapeHtml(book.feeling)}</p>` : ''}
        ${book.inquiryQuestion ? `<p><strong>탐구 질문</strong><br/>${escapeHtml(book.inquiryQuestion)}</p>` : ''}
        ${book.genre ? `<p><span class="badge">${book.genreIsAiGuess ? 'AI 추정 · ' : ''}${escapeHtml(book.genre)}</span></p>` : ''}
        <button class="btn secondary" id="close-detail">닫기</button>
      </div>
    `
    document.body.appendChild(backdrop)
    backdrop.querySelector('#close-detail')!.addEventListener('click', () => backdrop.remove())
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove() })
  }

  container.querySelector('#add-book')!.addEventListener('click', () => {
    openBookForm(state.session!.classCode, state.session!.studentId, async () => {
      state.student = await getStudent(state.session!.classCode, state.session!.studentId)
      await refresh()
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
