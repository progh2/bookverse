import type { Book } from '../types'
import { GENRE_COLORS, STAR_DUST_RULES } from '../types'
import { upsertBook, updateBook, type NewBookInput } from '../lib/books'
import { earnStarDust } from '../lib/students'
import { requestBookSuggestions, requestGenreTags, type BookSuggestion } from '../lib/ai'

const GENRES = Object.keys(GENRE_COLORS)

function formHtml(title: string, submitLabel: string, existing?: Book): string {
  const v = (s?: string) => s ?? ''
  return `
    <form class="modal" id="book-form">
      <h2>${title}</h2>
      <p class="hint">제목·저자·별점만 있어도 별이 생겨요. 나머지는 모두 선택이에요.</p>

      <label for="b-title">책 제목 *</label>
      <input id="b-title" required maxlength="80" autocomplete="off" value="${escapeAttr(v(existing?.title))}" />
      <div id="b-suggest" class="suggest-box" hidden></div>

      <label for="b-author">저자 * <span class="badge" id="b-author-badge" hidden>AI 추천</span></label>
      <input id="b-author" required maxlength="40" autocomplete="off" value="${escapeAttr(v(existing?.author))}" />

      <label>장르 <span class="badge" id="b-genre-badge" ${existing?.genre && existing.genreIsAiGuess ? '' : 'hidden'}>AI 추천</span></label>
      <div class="genre-chips" id="b-genre-chips">
        ${GENRES.map((g) => `<button type="button" class="genre-chip${existing?.genre === g ? ' selected' : ''}" data-genre="${g}" style="--chip-color:#${GENRE_COLORS[g].toString(16).padStart(6, '0')}">${g}</button>`).join('')}
      </div>
      <p class="hint" id="b-keywords">${(existing?.keywords ?? []).map((k) => `#${escapeAttr(k)}`).join(' ')}</p>

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

const normalizeTitle = (s: string) => s.replace(/[\s"'“”‘’.,:;!?·\-()[\]]/g, '').toLowerCase()

interface GenreState {
  genre: string | null
  keywords: string[]
  isAiGuess: boolean
}

/**
 * 제목을 입력하면 잠시 멈춘 뒤 AI에게 실제 책 후보(제목+저자)와 장르를 추천받아 보여준다.
 * - 후보를 누르면 제목·저자가 채워진다. 저자 칸이 비어 있고 첫 후보 제목이 입력과 같으면 저자를 자동으로 넣는다.
 * - 장르는 학생이 직접 고르기 전까지만 AI 추천으로 채운다(직접 고르면 그 값을 존중).
 */
function wireBookAssist(backdrop: HTMLElement, classCode: string, initial: GenreState): () => GenreState {
  const titleEl = backdrop.querySelector<HTMLInputElement>('#b-title')!
  const authorEl = backdrop.querySelector<HTMLInputElement>('#b-author')!
  const suggestEl = backdrop.querySelector<HTMLElement>('#b-suggest')!
  const authorBadge = backdrop.querySelector<HTMLElement>('#b-author-badge')!
  const genreBadge = backdrop.querySelector<HTMLElement>('#b-genre-badge')!
  const keywordsEl = backdrop.querySelector<HTMLElement>('#b-keywords')!
  const chips = [...backdrop.querySelectorAll<HTMLButtonElement>('.genre-chip')]

  const state: GenreState = { ...initial }
  let genreChosenByUser = !!initial.genre && !initial.isAiGuess
  let authorFilledByAi = false
  const cache = new Map<string, BookSuggestion>()
  let timer: number | undefined
  let requestSeq = 0

  function setGenre(genre: string | null, byAi: boolean) {
    state.genre = genre
    state.isAiGuess = byAi
    chips.forEach((c) => c.classList.toggle('selected', c.dataset.genre === genre))
    genreBadge.hidden = !(genre && byAi)
  }

  chips.forEach((chip) => chip.addEventListener('click', () => {
    genreChosenByUser = true
    setGenre(chip.dataset.genre!, false)
  }))

  authorEl.addEventListener('input', () => {
    authorFilledByAi = false
    authorBadge.hidden = true
  })

  function render(suggestion: BookSuggestion) {
    if (!genreChosenByUser) {
      setGenre(suggestion.genre, true)
      state.keywords = suggestion.keywords
      keywordsEl.textContent = suggestion.keywords.map((k) => `#${k}`).join(' ')
    }

    const typed = normalizeTitle(titleEl.value)
    const top = suggestion.candidates[0]
    if (top && !authorEl.value.trim() && normalizeTitle(top.title) === typed) {
      authorEl.value = top.author
      authorFilledByAi = true
      authorBadge.hidden = false
    }

    if (suggestion.candidates.length === 0) {
      suggestEl.innerHTML = suggestion.source === 'ai'
        ? '<span class="hint">AI가 확실한 책을 찾지 못했어요. 저자를 직접 입력해 주세요.</span>'
        : ''
      suggestEl.hidden = suggestion.source !== 'ai'
      return
    }
    suggestEl.innerHTML = `
      <span class="hint">✨ AI 추천 — 맞는 책을 누르세요</span>
      ${suggestion.candidates.map((c, i) => `
        <button type="button" class="suggest-chip" data-index="${i}">
          <strong>${escapeAttr(c.title)}</strong> · ${escapeAttr(c.author)}
        </button>`).join('')}
    `
    suggestEl.hidden = false
    suggestEl.querySelectorAll<HTMLButtonElement>('.suggest-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = suggestion.candidates[Number(btn.dataset.index)]
        titleEl.value = c.title
        authorEl.value = c.author
        authorFilledByAi = true
        authorBadge.hidden = false
        suggestEl.hidden = true
      })
    })
  }

  async function lookup() {
    const title = titleEl.value.trim()
    if (title.length < 2) {
      suggestEl.hidden = true
      return
    }
    const key = normalizeTitle(title)
    const cached = cache.get(key)
    if (cached) return render(cached)

    const seq = ++requestSeq
    suggestEl.innerHTML = '<span class="hint">🔎 AI가 책을 찾는 중...</span>'
    suggestEl.hidden = false
    const suggestion = await requestBookSuggestions(classCode, title)
    cache.set(key, suggestion)
    if (seq === requestSeq) render(suggestion) // 그 사이 제목이 또 바뀌었으면 옛 결과는 버린다
  }

  titleEl.addEventListener('input', () => {
    if (authorFilledByAi) {
      // AI가 넣은 저자는 제목이 바뀌면 더 이상 맞지 않을 수 있어 비운다
      authorEl.value = ''
      authorFilledByAi = false
      authorBadge.hidden = true
    }
    window.clearTimeout(timer)
    timer = window.setTimeout(lookup, 700)
  })

  return () => state
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
  const getGenre = wireBookAssist(backdrop, classCode, { genre: null, keywords: [], isAiGuess: false })
  backdrop.querySelector<HTMLInputElement>('#b-title')!.focus()

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
      let { genre, keywords, isAiGuess } = getGenre()
      if (!genre) {
        // 아직 추천을 못 받았거나 장르를 고르지 않았으면 저장 직전에 한 번 더 AI에게 묻는다
        submitBtn.textContent = 'AI가 장르를 살펴보는 중...'
        const tags = await requestGenreTags(classCode, f.title, f.author, f.quote)
        genre = tags.genre
        keywords = tags.keywords
        isAiGuess = true
      }

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
        genreIsAiGuess: isAiGuess, // 학생이 직접 고른 장르면 'AI 추정' 표시를 하지 않는다
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
  const getGenre = wireBookAssist(backdrop, classCode, {
    genre: existing.genre ?? null,
    keywords: existing.keywords ?? [],
    isAiGuess: !!existing.genreIsAiGuess,
  })

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
        genre: getGenre().genre ?? existing.genre,
        genreIsAiGuess: getGenre().genre ? getGenre().isAiGuess : existing.genreIsAiGuess,
        keywords: getGenre().keywords,
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
