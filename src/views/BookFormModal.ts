import type { Book } from '../types'
import { STAR_DUST_RULES } from '../types'
import { upsertBook, type NewBookInput } from '../lib/books'
import { earnStarDust } from '../lib/students'
import { guessGenre } from '../lib/genre'

export function openBookForm(
  classCode: string,
  studentId: string,
  onSaved: (book: Book) => void,
) {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <form class="modal" id="book-form">
      <h2>📖 책 등록하기</h2>
      <p class="hint">제목·저자·별점만 있어도 별이 생겨요. 나머지는 모두 선택이에요.</p>

      <label for="b-title">책 제목 *</label>
      <input id="b-title" required maxlength="80" />

      <label for="b-author">저자 *</label>
      <input id="b-author" required maxlength="40" />

      <label for="b-rating">별점 *</label>
      <select id="b-rating" required>
        <option value="">선택</option>
        ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${'★'.repeat(n)}</option>`).join('')}
      </select>

      <p class="hint" style="margin-top:18px">가벼운 활동</p>
      <div class="activity-grid">
        <div>
          <label for="b-quote">인상 깊은 문장</label>
          <textarea id="b-quote" maxlength="300"></textarea>
        </div>
        <div>
          <label for="b-quote-page">쪽수</label>
          <input id="b-quote-page" placeholder="예: 12-15" />
          <label for="b-reason">읽은 계기</label>
          <textarea id="b-reason" maxlength="200"></textarea>
        </div>
      </div>
      <label><input type="checkbox" id="b-reread" style="width:auto;display:inline-block;margin-right:6px" />다시 읽은 책이에요</label>

      <p class="hint" style="margin-top:18px">깊은 활동</p>
      <label for="b-summary">요약</label>
      <textarea id="b-summary" maxlength="500"></textarea>
      <label for="b-feeling">느낀점</label>
      <textarea id="b-feeling" maxlength="500"></textarea>
      <label for="b-inquiry">탐구 질문 (100자 이내)</label>
      <input id="b-inquiry" maxlength="100" placeholder="더 알고 싶어진 것 한 줄" />

      <label><input type="checkbox" id="b-bigstar" style="width:auto;display:inline-block;margin-right:6px" />마음에 남은 책 — 큰 별로 지정</label>
      <input id="b-bigstar-reason" maxlength="30" placeholder="한 줄 이유 (30자 이내)" style="margin-top:8px" />

      <div style="display:flex; gap:10px; margin-top:20px">
        <button type="button" class="btn secondary" id="b-cancel">취소</button>
        <button type="submit" class="btn" id="b-submit">별 만들기</button>
      </div>
      <p class="error-text" id="b-error"></p>
    </form>
  `
  document.body.appendChild(backdrop)

  const close = () => backdrop.remove()
  backdrop.querySelector('#b-cancel')!.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })

  const form = backdrop.querySelector<HTMLFormElement>('#book-form')!
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = backdrop.querySelector<HTMLElement>('#b-error')!
    const submitBtn = backdrop.querySelector<HTMLButtonElement>('#b-submit')!
    errorEl.textContent = ''

    const title = val(backdrop, '#b-title')
    const author = val(backdrop, '#b-author')
    const ratingRaw = val(backdrop, '#b-rating')
    if (!title || !author || !ratingRaw) {
      errorEl.textContent = '제목, 저자, 별점만 있어도 별이 생겨요 — 세 가지는 꼭 채워주세요.'
      return
    }

    submitBtn.disabled = true
    try {
      const quote = val(backdrop, '#b-quote')
      const reason = val(backdrop, '#b-reason')
      const reread = (backdrop.querySelector<HTMLInputElement>('#b-reread')!).checked
      const summary = val(backdrop, '#b-summary')
      const feeling = val(backdrop, '#b-feeling')
      const inquiry = val(backdrop, '#b-inquiry')
      const isBigStar = (backdrop.querySelector<HTMLInputElement>('#b-bigstar')!).checked
      const bigStarReason = val(backdrop, '#b-bigstar-reason')

      const { genre, keywords } = guessGenre(title)

      const input: NewBookInput = {
        title,
        author,
        rating: Number(ratingRaw),
        quote: quote || undefined,
        quotePage: val(backdrop, '#b-quote-page') || undefined,
        reason: reason || undefined,
        rereadCount: reread ? 1 : undefined,
        summary: summary || undefined,
        feeling: feeling || undefined,
        inquiryQuestion: inquiry || undefined,
        isBigStar: isBigStar || undefined,
        bigStarReason: bigStarReason || undefined,
        genre,
        genreIsAiGuess: true,
        keywords,
      }

      const { book } = await upsertBook(classCode, studentId, input)

      let dust = STAR_DUST_RULES.registerBook
      if (quote) dust += STAR_DUST_RULES.quote
      if (reason) dust += STAR_DUST_RULES.reason
      if (reread) dust += STAR_DUST_RULES.reread
      if (summary) dust += STAR_DUST_RULES.summary
      if (feeling) dust += STAR_DUST_RULES.feeling
      if (inquiry) dust += STAR_DUST_RULES.inquiryQuestion
      await earnStarDust(classCode, studentId, dust)

      close()
      onSaved(book)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      submitBtn.disabled = false
    }
  })
}

function val(root: HTMLElement, selector: string): string {
  return (root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? '').trim()
}
