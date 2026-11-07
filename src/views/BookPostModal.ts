import { computeBrightness, STAR_DUST_RULES, type Book } from '../types'
import { addComment, deleteComment, listComments } from '../lib/comments'
import { earnStarDust } from '../lib/students'
import { formatDateTime, toMillis } from '../lib/time'
import { openEditBook } from './BookFormModal'

interface PostOptions {
  authorNickname: string
  viewer: { classCode: string; studentId: string; nickname: string }
  onChanged?: () => void
}

/** 게시판에서 책 하나를 눌렀을 때 뜨는 상세 글 화면(모든 기록 + 친구들의 의견). */
export function openBookPost(book: Book, opts: PostOptions) {
  const { viewer } = opts
  const isMine = book.studentId === viewer.studentId
  const brightness = computeBrightness(book)

  const activities: [string, boolean][] = [
    ['문장', !!book.quote],
    ['읽은 계기', !!book.reason],
    ['다시 읽음', !!book.rereadCount],
    ['요약', !!book.summary],
    ['느낀점', !!book.feeling],
    ['탐구 질문', !!book.inquiryQuestion],
  ]

  const section = (label: string, value?: string) =>
    value ? `<div class="post-section"><div class="post-label">${label}</div><div>${escapeHtml(value)}</div></div>` : ''

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal post-modal">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
        <div>
          <h2 style="margin:0 0 4px">${book.isBigStar ? '🌟' : '⭐'} ${escapeHtml(book.title)}</h2>
          <div class="hint">${escapeHtml(book.author)} · ${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}</div>
        </div>
        <button class="hud-icon-btn" id="post-close" style="font-size:20px" aria-label="닫기">✕</button>
      </div>

      <div class="hint" style="margin-top:8px">
        <strong style="color:var(--text)">${escapeHtml(opts.authorNickname)}</strong>님의 별 · 밝기 ${brightness}/5
        ${toMillis(book.createdAt) ? ` · ${formatDateTime(toMillis(book.createdAt))}` : ''}
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px">
        ${book.genre ? `<span class="badge">${book.genreIsAiGuess ? 'AI 추정 · ' : ''}${escapeHtml(book.genre)}</span>` : ''}
        ${(book.keywords ?? []).map((k) => `<span class="badge" style="background:rgba(143,180,255,0.15); color:var(--line-blue)">#${escapeHtml(k)}</span>`).join('')}
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px">
        ${activities.map(([label, done]) => `<span class="activity-chip${done ? ' done' : ''}">${done ? '✓' : '·'} ${label}</span>`).join('')}
      </div>

      ${book.quote ? `<blockquote class="post-quote">“${escapeHtml(book.quote)}”${book.quotePage ? `<div class="hint">${escapeHtml(book.quotePage)}쪽</div>` : ''}</blockquote>` : ''}
      ${section('읽은 계기', book.reason)}
      ${book.rereadCount ? '<div class="post-section"><div class="post-label">다시 읽음</div><div>다시 읽은 책이에요 🔁</div></div>' : ''}
      ${section('요약', book.summary)}
      ${section('느낀점', book.feeling)}
      ${section('탐구 질문', book.inquiryQuestion)}
      ${book.isBigStar ? section('큰 별로 고른 이유', book.bigStarReason || '마음에 남은 책') : ''}

      ${isMine ? '<button class="btn secondary" id="post-edit" style="margin-top:12px">✏️ 내 기록 수정</button>' : ''}

      <h3 style="margin:22px 0 8px; font-size:15px">💬 친구들의 의견 <span class="hint" id="comment-count"></span></h3>
      <div id="comment-list"><p class="hint">불러오는 중...</p></div>

      <form id="comment-form" style="margin-top:10px">
        <textarea id="comment-text" maxlength="300" placeholder="${isMine ? '내 별에 덧붙이고 싶은 이야기' : `${escapeHtml(opts.authorNickname)}님의 책에 대한 생각을 남겨주세요`}" style="min-height:60px"></textarea>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px">
          <span class="hint" id="comment-hint">${isMine ? '' : `의견을 남기면 별가루 ${STAR_DUST_RULES.cheerMessage}개를 받아요`}</span>
          <button class="btn" type="submit" id="comment-submit" style="width:auto; margin-top:0; padding:8px 16px">의견 남기기</button>
        </div>
        <p class="error-text" id="comment-error"></p>
      </form>
    </div>
  `
  document.body.appendChild(backdrop)

  const close = () => backdrop.remove()
  backdrop.querySelector('#post-close')!.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })

  backdrop.querySelector('#post-edit')?.addEventListener('click', () => {
    close()
    openEditBook(viewer.classCode, book.studentId, book, () => opts.onChanged?.())
  })

  const listEl = backdrop.querySelector<HTMLElement>('#comment-list')!
  const countEl = backdrop.querySelector<HTMLElement>('#comment-count')!

  async function loadComments() {
    try {
      const comments = await listComments(viewer.classCode, book.studentId, book.id)
      countEl.textContent = comments.length ? `${comments.length}개` : ''
      if (comments.length === 0) {
        listEl.innerHTML = '<p class="hint">아직 의견이 없어요. 첫 의견을 남겨보세요!</p>'
        return
      }
      listEl.innerHTML = comments.map((c) => `
        <div class="comment-row" data-id="${c.id}">
          <div style="display:flex; justify-content:space-between; gap:8px">
            <strong style="font-size:13px">${escapeHtml(c.authorNickname)}${c.authorId === book.studentId ? ' <span class="badge">글쓴이</span>' : ''}</strong>
            <span class="hint">${formatDateTime(toMillis(c.createdAt))}
              ${c.authorId === viewer.studentId ? `<button class="hud-icon-btn comment-delete" data-id="${c.id}" title="삭제">🗑</button>` : ''}
            </span>
          </div>
          <div style="margin-top:2px; white-space:pre-wrap">${escapeHtml(c.text)}</div>
        </div>
      `).join('')
      listEl.querySelectorAll<HTMLButtonElement>('.comment-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('이 의견을 지울까요?')) return
          await deleteComment(viewer.classCode, book.studentId, book.id, btn.dataset.id!)
          await loadComments()
        })
      })
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">의견을 불러오지 못했어요: ${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`
    }
  }

  backdrop.querySelector('#comment-form')!.addEventListener('submit', async (e) => {
    e.preventDefault()
    const textEl = backdrop.querySelector<HTMLTextAreaElement>('#comment-text')!
    const errorEl = backdrop.querySelector<HTMLElement>('#comment-error')!
    const submitBtn = backdrop.querySelector<HTMLButtonElement>('#comment-submit')!
    errorEl.textContent = ''
    submitBtn.disabled = true
    try {
      await addComment(viewer.classCode, book.studentId, book.id, { id: viewer.studentId, nickname: viewer.nickname }, textEl.value)
      textEl.value = ''
      if (!isMine) await earnStarDust(viewer.classCode, viewer.studentId, STAR_DUST_RULES.cheerMessage)
      await loadComments()
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
    } finally {
      submitBtn.disabled = false
    }
  })

  loadComments()
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
