import type { Book } from '../types'
import { STAR_DUST_RULES } from '../types'
import { upsertBook, updateBook, type NewBookInput } from '../lib/books'
import { earnStarDust } from '../lib/students'
import { requestGenreTags } from '../lib/ai'

function formHtml(title: string, submitLabel: string, existing?: Book): string {
  const v = (s?: string) => s ?? ''
  return `
    <form class="modal" id="book-form">
      <h2>${title}</h2>
      <p class="hint">제목·저자·별점만 있어도 별이 생겨요. 나머지는 모두 선택이에요.</p>

      <label for="b-title">책 제목 *</label>
      <input id="b-title" required maxlength="80" value="${escapeAttr(v(existing?.title))}" />

      <label for="b-author">저자 *</label>
      <input id="b-author" required maxlength="40" value="${escapeAttr(v(existing?.author))}" />

      <label for="b-rating">별점 *</label>
      <select id="b-rating" required>
        <option value="">선택</option>
        ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${existing?.rating === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}
      </select>

      <p class="hint" style="margin-top:18px">가벼운 활동</p>
      <div class="activity-grid">
        <div>
          <label for="b-quote">인상 깊은 문장</label>
          <textarea id="b-quote" maxlength="300">${v(existing?.quote)}</textarea>
        </div>
        <div>
          <label for="b-quote-page">쪽수</label>
          <input id="b-quote-page" placeholder="예: 12-15" value="${escapeAttr(v(existing?.quotePage))}" />
          <label for="b-reason">읽은 계기</label>
          <textarea id="b-reason" maxlength="200">${v(existing?.reason)}</textarea>
        </div>
      </div>
      <label><input type="checkbox" id="b-reread" ${existing?.rereadCount ? 'checked' : ''} style="width:auto;display:inline-block;margin-right:6px" />다시 읽은 책이에요</label>

      <p class="hint" style="margin-top:18px">깊은 활동</p>
      <label for="b-summary">요약</label>
      <textarea id="b-summary" maxlength="500">${v(existing?.summary)}</textarea>
      <label for="b-feeling">느낀점</label>
      <textarea id="b-feeling" maxlength="500">${v(existing?.feeling)}</textarea>
      <label for="b-inquiry">탐구 질문 (100자 이내)</label>
      <input id="b-inquiry" maxlength="100" placeholder="더 알고 싶어진 것 한 줄" value="${escapeAttr(v(existing?.inquiryQuestion))}" />

      <label><input type="checkbox" id="b-bigstar" ${existing?.isBigStar ? 'checked' : ''} style="width:auto;display:inline-block;margin-right:6px" />마음에 남은 책 — 큰 별로 지정</label>
      <input id="b-bigstar-reason" maxlength="30" placeholder="한 줄 이유 (30자 이내)" value="${escapeAttr(v(existing?.bigStarReason))}" style="margin-top:8px" />

      <div style="display:flex; gap:10px; margin-top:20px">
        <button type="button" class="btn secondary" id="b-cancel">취소</button>
        <button type="submit" class="btn" id="b-submit">${submitLabel}</button>
      </div>
      <p class="error-text" id="b-error"></p>
    </form>
  `
}

function readForm(backdrop: HTMLElement) {
  return {
    title: val(backdrop, '#b-title'),
    author: val(backdrop, '#b-author'),
    ratingRaw: val(backdrop, '#b-rating'),
    quote: val(backdrop, '#b-quote'),
    quotePage: val(backdrop, '#b-quote-page'),
    reason: val(backdrop, '#b-reason'),
    reread: backdrop.querySelector<HTMLInputElement>('#b-reread')!.checked,
    summary: val(backdrop, '#b-summary'),
    feeling: val(backdrop, '#b-feeling'),
    inquiry: val(backdrop, '#b-inquiry'),
    isBigStar: backdrop.querySelector<HTMLInputElement>('#b-bigstar')!.checked,
    bigStarReason: val(backdrop, '#b-bigstar-reason'),
  }
}

function mountModal(html: string): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = html
  document.body.appendChild(backdrop)
  const close = () => backdrop.remove()
  backdrop.querySelector('#b-cancel')!.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  return backdrop
}

export function openBookForm(
  classCode: string,
  studentId: string,
  onSaved: (book: Book) => void,
) {
  const backdrop = mountModal(formHtml('📖 책으로 별 만들기', '별 만들기'))
  const form = backdrop.querySelector<HTMLFormElement>('#book-form')!

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = backdrop.querySelector<HTMLElement>('#b-error')!
    const submitBtn = backdrop.querySelector<HTMLButtonElement>('#b-submit')!
    errorEl.textContent = ''

    const f = readForm(backdrop)
    if (!f.title || !f.author || !f.ratingRaw) {
      errorEl.textContent = '제목, 저자, 별점만 있어도 별이 생겨요 — 세 가지는 꼭 채워주세요.'
      return
    }

    submitBtn.disabled = true
    try {
      submitBtn.textContent = 'AI가 장르를 살펴보는 중...'
      const { genre, keywords } = await requestGenreTags(classCode, f.title, f.author, f.quote)

      const input: NewBookInput = {
        title: f.title,
        author: f.author,
        rating: Number(f.ratingRaw),
        quote: f.quote || undefined,
        quotePage: f.quotePage || undefined,
        reason: f.reason || undefined,
        rereadCount: f.reread ? 1 : undefined,
        summary: f.summary || undefined,
        feeling: f.feeling || undefined,
        inquiryQuestion: f.inquiry || undefined,
        isBigStar: f.isBigStar || undefined,
        bigStarReason: f.bigStarReason || undefined,
        genre,
        genreIsAiGuess: true, // AI 실연동이든 폴백이든 '추정'이므로 학생이 고칠 수 있게 표시
        keywords,
      }

      const { book } = await upsertBook(classCode, studentId, input)

      let dust = STAR_DUST_RULES.registerBook
      if (f.quote) dust += STAR_DUST_RULES.quote
      if (f.reason) dust += STAR_DUST_RULES.reason
      if (f.reread) dust += STAR_DUST_RULES.reread
      if (f.summary) dust += STAR_DUST_RULES.summary
      if (f.feeling) dust += STAR_DUST_RULES.feeling
      if (f.inquiry) dust += STAR_DUST_RULES.inquiryQuestion
      await earnStarDust(classCode, studentId, dust)

      backdrop.remove()
      onSaved(book)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      submitBtn.disabled = false
      submitBtn.textContent = '별 만들기'
    }
  })
}

/** 학생 본인이 이미 등록한 책 내용을 고친다. 별가루는 다시 지급하지 않는다. */
export function openEditBook(
  classCode: string,
  studentId: string,
  existing: Book,
  onSaved: (book: Book) => void,
) {
  const backdrop = mountModal(formHtml('✏️ 책 정보 수정', '수정 저장', existing))
  const form = backdrop.querySelector<HTMLFormElement>('#book-form')!

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = backdrop.querySelector<HTMLElement>('#b-error')!
    const submitBtn = backdrop.querySelector<HTMLButtonElement>('#b-submit')!
    errorEl.textContent = ''

    const f = readForm(backdrop)
    if (!f.title || !f.author || !f.ratingRaw) {
      errorEl.textContent = '제목, 저자, 별점만 있어도 별이 생겨요 — 세 가지는 꼭 채워주세요.'
      return
    }

    submitBtn.disabled = true
    try {
      const patch: NewBookInput = {
        title: f.title,
        author: f.author,
        rating: Number(f.ratingRaw),
        quote: f.quote || undefined,
        quotePage: f.quotePage || undefined,
        reason: f.reason || undefined,
        rereadCount: f.reread ? 1 : undefined,
        summary: f.summary || undefined,
        feeling: f.feeling || undefined,
        inquiryQuestion: f.inquiry || undefined,
        isBigStar: f.isBigStar || undefined,
        bigStarReason: f.bigStarReason || undefined,
        genre: existing.genre,
        genreIsAiGuess: existing.genreIsAiGuess,
        keywords: existing.keywords,
      }
      await updateBook(classCode, studentId, existing.id, patch)
      backdrop.remove()
      onSaved({ ...existing, ...patch })
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      submitBtn.disabled = false
    }
  })
}

function val(root: HTMLElement, selector: string): string {
  return (root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? '').trim()
}

function escapeAttr(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
