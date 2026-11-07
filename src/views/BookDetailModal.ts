import { computeBrightness, type Book } from '../types'
import { openEditBook } from './BookFormModal'

export function openBookDetail(
  classCode: string,
  book: Book,
  opts: { canEdit: boolean; authorNickname?: string; onChanged?: () => void } = { canEdit: false },
) {
  const brightness = computeBrightness(book)
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal">
      <h2>${book.isBigStar ? '🌟' : '⭐'} ${escapeHtml(book.title)}</h2>
      <p class="hint">
        ${opts.authorNickname ? `${escapeHtml(opts.authorNickname)} · ` : ''}${escapeHtml(book.author)} · 밝기 ${brightness}/5 · ${'★'.repeat(book.rating)}
      </p>
      ${book.quote ? `<p>"${escapeHtml(book.quote)}"${book.quotePage ? ` (${escapeHtml(book.quotePage)}쪽)` : ''}</p>` : ''}
      ${book.reason ? `<p><strong>읽은 계기</strong><br/>${escapeHtml(book.reason)}</p>` : ''}
      ${book.summary ? `<p><strong>요약</strong><br/>${escapeHtml(book.summary)}</p>` : ''}
      ${book.feeling ? `<p><strong>느낀점</strong><br/>${escapeHtml(book.feeling)}</p>` : ''}
      ${book.inquiryQuestion ? `<p><strong>탐구 질문</strong><br/>${escapeHtml(book.inquiryQuestion)}</p>` : ''}
      ${book.genre ? `<p><span class="badge">${book.genreIsAiGuess ? 'AI 추정 · ' : ''}${escapeHtml(book.genre)}</span></p>` : ''}
      <div style="display:flex; gap:10px">
        <button class="btn secondary" id="close-detail">닫기</button>
        ${opts.canEdit ? '<button class="btn" id="edit-detail">수정</button>' : ''}
      </div>
    </div>
  `
  document.body.appendChild(backdrop)
  backdrop.querySelector('#close-detail')!.addEventListener('click', () => backdrop.remove())
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove() })

  if (opts.canEdit) {
    backdrop.querySelector('#edit-detail')!.addEventListener('click', () => {
      backdrop.remove()
      openEditBook(classCode, book.studentId, book, () => opts.onChanged?.())
    })
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
