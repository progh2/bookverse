import type { Book } from '../types'
import { GENRE_COLORS, STAR_DUST_RULES } from '../types'
import { upsertBook, updateBook, type NewBookInput } from '../lib/books'
import { earnStarDust } from '../lib/students'
import { requestBookSuggestions, requestGenreTags, type BookSuggestion } from '../lib/ai'

const GENRES = Object.keys(GENRE_COLORS)

/**
 * 책 등록/수정 폼. 처음 등록할 때는 필수 정보(제목·저자·별점)와 장르만 받는다.
 * 문장·느낀점·요약 같은 기록은 등록 뒤 책 상세 화면에서 본인·친구가 여러 개씩 더한다.
 */
function formHtml(title: string, submitLabel: string, existing?: Book): string {
  const v = (s?: string) => s ?? ''
  return `
    <form class="modal" id="book-form">
      <h2>${title}</h2>
      <p class="hint">${existing
        ? '책의 기본 정보를 고쳐요. 문장·느낀점 같은 기록은 책 상세 화면에서 더하고 고칠 수 있어요.'
        : '제목·저자·별점만 넣으면 별이 생겨요. 문장·느낀점 같은 기록은 별을 만든 뒤 얼마든지 더할 수 있어요.'}</p>

      <label for="b-title">책 제목 *</label>
      <input id="b-title" required maxlength="80" autocomplete="off" value="${escapeAttr(v(existing?.title))}" />
      <div id="b-suggest" class="suggest-box" hidden></div>

      <label for="b-author">저자 * <span class="badge" id="b-author-badge" hidden>AI 추천</span></label>
      <input id="b-author" required maxlength="40" autocomplete="off" value="${escapeAttr(v(existing?.author))}" />

      <label for="b-rating">별점 *</label>
      <select id="b-rating" required>
        <option value="">선택</option>
        ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${existing?.rating === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}
      </select>

      <label>장르 <span class="badge" id="b-genre-badge" ${existing?.genre && existing.genreIsAiGuess ? '' : 'hidden'}>AI 추천</span></label>
      <div class="genre-chips" id="b-genre-chips">
        ${GENRES.map((g) => `<button type="button" class="genre-chip${existing?.genre === g ? ' selected' : ''}" data-genre="${g}" style="--chip-color:#${GENRE_COLORS[g].toString(16).padStart(6, '0')}">${g}</button>`).join('')}
      </div>
      <p class="hint" id="b-keywords">${(existing?.keywords ?? []).map((k) => `#${escapeAttr(k)}`).join(' ')}</p>

      <div style="display:flex; gap:10px; margin-top:20px">
        <button type="button" class="btn secondary" id="b-cancel">취소</button>
        <button type="submit" class="btn" id="b-submit">${submitLabel}</button>
      </div>
      <p class="error-text" id="b-error"></p>
    </form>
  `
}

function readRequired(backdrop: HTMLElement) {
  return {
    title: val(backdrop, '#b-title'),
    author: val(backdrop, '#b-author'),
    rating: Number(val(backdrop, '#b-rating')),
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

const REQUIRED_MESSAGE = '제목, 저자, 별점만 있으면 별이 생겨요 — 세 가지는 꼭 채워주세요.'

/** 새 별 만들기. 같은 책을 이미 등록했으면 새 별을 만들지 않고 기존 별을 돌려준다(isNew=false). */
export function openBookForm(
  classCode: string,
  studentId: string,
  onSaved: (book: Book, isNew: boolean) => void,
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

    const f = readRequired(backdrop)
    if (!f.title || !f.author || !f.rating) {
      errorEl.textContent = REQUIRED_MESSAGE
      return
    }

    submitBtn.disabled = true
    try {
      let { genre, keywords, isAiGuess } = getGenre()
      if (!genre) {
        // 아직 추천을 못 받았거나 장르를 고르지 않았으면 저장 직전에 한 번 더 AI에게 묻는다
        submitBtn.textContent = 'AI가 장르를 살펴보는 중...'
        const tags = await requestGenreTags(classCode, f.title, f.author)
        genre = tags.genre
        keywords = tags.keywords
        isAiGuess = true
      }

      const input: NewBookInput = {
        title: f.title,
        author: f.author,
        rating: f.rating,
        genre,
        genreIsAiGuess: isAiGuess, // 학생이 직접 고른 장르면 'AI 추정' 표시를 하지 않는다
        keywords,
      }
      const { book, isNew } = await upsertBook(classCode, studentId, input)
      if (isNew) await earnStarDust(classCode, studentId, STAR_DUST_RULES.registerBook)

      backdrop.remove()
      onSaved(book, isNew)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      submitBtn.disabled = false
      submitBtn.textContent = '별 만들기'
    }
  })
}

/** 책 기본 정보(제목·저자·별점·장르)를 고친다. 별가루는 다시 지급하지 않는다. */
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

    const f = readRequired(backdrop)
    if (!f.title || !f.author || !f.rating) {
      errorEl.textContent = REQUIRED_MESSAGE
      return
    }

    submitBtn.disabled = true
    try {
      const g = getGenre()
      const patch: NewBookInput = {
        title: f.title,
        author: f.author,
        rating: f.rating,
        genre: g.genre ?? existing.genre,
        genreIsAiGuess: g.genre ? g.isAiGuess : existing.genreIsAiGuess,
        keywords: g.keywords,
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
