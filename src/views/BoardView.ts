import { listClassBooks } from '../lib/books'
import { listStudents } from '../lib/students'
import { state } from '../state'
import { navigate } from '../router'
import { openBookDetail } from './BookDetailModal'
import type { Book } from '../types'

/** Firestore에서 읽어온 createdAt은 Timestamp 객체로 오고, 방금 로컬에서 만든 값은 number다. */
function toMillis(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000
  }
  return 0
}

export async function renderBoard(container: HTMLElement): Promise<void> {
  if (!state.session) {
    navigate('/auth')
    return
  }

  container.innerHTML = `
    <div class="view">
      <div class="panel">
        <h1>📋 게시판</h1>
        <p class="hint">우리 학급 친구들이 등록한 책이 최신순으로 보여요. 내가 등록한 책은 눌러서 바로 고칠 수 있어요.</p>
        <div id="board-list" style="margin-top:16px"><p class="hint">불러오는 중...</p></div>
      </div>
    </div>
  `

  const listEl = container.querySelector<HTMLElement>('#board-list')!

  const [books, students] = await Promise.all([
    listClassBooks(state.session.classCode),
    listStudents(state.session.classCode),
  ])
  const nicknameOf = new Map(students.map((s) => [s.id, s.nickname]))

  const sorted = [...books].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))

  if (sorted.length === 0) {
    listEl.innerHTML = '<p class="hint">아직 등록된 책이 없어요.</p>'
    return
  }

  listEl.innerHTML = sorted
    .map(
      (book, i) => `
      <div class="book-row" data-index="${i}" style="cursor:pointer">
        <div>
          <strong>${escapeHtml(book.title)}</strong>
          <span class="hint"> · ${escapeHtml(book.author)}</span>
          <div class="hint">${escapeHtml(nicknameOf.get(book.studentId) ?? '알 수 없음')} · ${'★'.repeat(book.rating)} ${book.genre ? `· ${escapeHtml(book.genre)}` : ''}</div>
        </div>
        <div class="hint">${formatDate(toMillis(book.createdAt))}${book.studentId === state.session!.studentId ? ' <span class="badge">내 책</span>' : ''}</div>
      </div>
    `,
    )
    .join('')

  listEl.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
    const book: Book = sorted[Number(el.dataset.index)]
    el.addEventListener('click', () => {
      openBookDetail(state.session!.classCode, book, {
        canEdit: book.studentId === state.session!.studentId,
        authorNickname: nicknameOf.get(book.studentId),
        onChanged: () => renderBoard(container),
      })
    })
  })
}

function formatDate(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
