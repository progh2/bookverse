import {
  computeBrightness, ENTRY_TYPES, entryTypeInfo, type Book, type BookEntry, type EntryType,
} from '../types'
import { addEntry, deleteEntry, listEntries, MAX_IMAGE_LENGTH, updateEntry, type Viewer } from '../lib/entries'
import { deleteBook, getBook, listBooks, setBigStar } from '../lib/books'
import { isTeacherOf } from '../lib/classes'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import { compressImage } from '../lib/image'
import { formatDateTime, toMillis } from '../lib/time'
import { openEditBook } from './BookFormModal'
import { openQuoteCard } from './QuoteCard'

interface EntryDraft {
  type: EntryType
  text: string
  page: string
}

interface PostOptions {
  authorNickname: string // 책 주인 닉네임
  viewer: Viewer
  onChanged?: () => void // 별 밝기·목록을 다시 그려야 할 때(기록 추가/수정/삭제, 기본 정보 수정, 큰 별)
}

/**
 * 책 상세 화면. 내 별자리(별 클릭)·학급 성운(별 클릭)·게시판 어디서 열어도 같은 화면이다.
 * 책 주인과 친구 모두 문장·느낀점·요약 등 기록을 여러 개 더할 수 있고, 자기가 쓴 기록은 고치거나 지울 수 있다.
 */
export function openBookPost(initialBook: Book, opts: PostOptions) {
  const { viewer } = opts
  let book = initialBook
  let entries: BookEntry[] = []
  let editingId: string | null = null
  let teacher = false // 담당 교사로 로그인했으면 모든 기록·책을 지울 수 있다
  let photo: string | null = null // 고른 필사 사진(줄인 data URL)
  const isMine = book.studentId === viewer.studentId
  // 작성 중인 기록은 책·작성자별로 임시저장해 두었다가 다시 열면 이어서 쓴다
  const draftKey = `entry.${book.classCode}.${book.id}.${viewer.studentId}`
  const draft: EntryDraft = { type: 'quote', text: '', page: '', ...loadDraft<EntryDraft>(draftKey) }

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `<div class="modal post-modal" id="post-modal"></div>`
  document.body.appendChild(backdrop)
  const modal = backdrop.querySelector<HTMLElement>('#post-modal')!
  const close = () => backdrop.remove()
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })

  function headerHtml(): string {
    const brightness = computeBrightness(book)
    const counts = book.entryCounts ?? {}
    return `
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
        ${ENTRY_TYPES.filter((t) => t.type !== 'opinion').map((t) => {
          const n = counts[t.type] ?? 0
          return `<span class="activity-chip${n ? ' done' : ''}">${t.icon} ${t.label}${n ? ` ${n}` : ''}</span>`
        }).join('')}
      </div>
      ${book.isBigStar ? `<div class="post-section"><div class="post-label">🌟 큰 별로 고른 이유</div><div>${escapeHtml(book.bigStarReason || '마음에 남은 책')}</div></div>` : ''}
      ${isMine ? `
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
          <button class="btn secondary" id="post-edit" style="width:auto; margin-top:0">✏️ 기본 정보 수정</button>
          <button class="btn secondary" id="post-bigstar" style="width:auto; margin-top:0">${book.isBigStar ? '큰 별 해제' : '🌟 큰 별로 지정'}</button>
        </div>
        <p class="error-text" id="bigstar-msg"></p>` : ''}
      ${teacher ? `
        <div class="teacher-bar">
          <span>👩‍🏫 교사 관리</span>
          <button class="btn secondary" id="post-delete-book" style="width:auto; margin-top:0; color:#ff8a8a">🗑 이 책(별) 삭제</button>
        </div>` : ''}
    `
  }

  function entryCardHtml(e: BookEntry): string {
    const mine = e.authorId === viewer.studentId
    if (editingId === e.id) {
      const info = entryTypeInfo(e.type)
      return `
        <div class="entry-card" data-id="${e.id}">
          <textarea class="entry-edit-text" maxlength="${info.maxLength}">${escapeHtml(e.text)}</textarea>
          ${e.type === 'quote' ? `<input class="entry-edit-page" placeholder="쪽수(예: 12-15)" value="${escapeHtml(e.page ?? '')}" style="margin-top:6px" />` : ''}
          <div style="display:flex; gap:6px; justify-content:flex-end; margin-top:6px">
            <button class="btn secondary entry-cancel" style="width:auto; margin-top:0; padding:6px 12px">취소</button>
            <button class="btn entry-save" style="width:auto; margin-top:0; padding:6px 12px">저장</button>
          </div>
        </div>`
    }
    const body = e.type === 'quote'
      ? `<div class="entry-quote">“${escapeHtml(e.text)}”</div>${e.page ? `<div class="hint">${escapeHtml(e.page)}쪽</div>` : ''}`
      : e.type === 'photo'
        ? `${safeImage(e.image) ? `<img class="entry-photo" src="${safeImage(e.image)}" alt="필사 사진" loading="lazy" />` : '<p class="hint">사진을 불러올 수 없어요</p>'}
           ${e.text ? `<div style="white-space:pre-wrap; margin-top:6px">${escapeHtml(e.text)}</div>` : ''}`
        : `<div style="white-space:pre-wrap">${escapeHtml(e.text || '다시 읽었어요 🔁')}</div>`
    return `
      <div class="entry-card" data-id="${e.id}">
        ${body}
        <div class="entry-meta">
          <span>${escapeHtml(e.authorNickname)}${e.authorId === book.studentId ? ' <span class="badge">책 주인</span>' : ''}
            · ${formatDateTime(toMillis(e.createdAt))}${e.updatedAt ? ' (수정됨)' : ''}</span>
          <span>
            ${e.type === 'quote' ? '<button class="hud-icon-btn entry-card-btn" title="한 소절 카드 만들기">🃏 카드</button>' : ''}
            ${mine ? '<button class="hud-icon-btn entry-edit" title="고치기">✏️</button>' : ''}
            ${mine || teacher ? `<button class="hud-icon-btn entry-delete" title="${mine ? '지우기' : '교사 삭제'}">🗑</button>` : ''}
          </span>
        </div>
      </div>`
  }

  function entriesHtml(): string {
    if (entries.length === 0) {
      return `<p class="hint">아직 남긴 기록이 없어요. ${isMine ? '첫 문장이나 느낀점을 남겨 별을 밝혀보세요!' : '첫 기록을 남겨보세요!'}</p>`
    }
    return ENTRY_TYPES
      .map((t) => {
        const list = entries.filter((e) => e.type === t.type)
        if (list.length === 0) return ''
        return `<div class="post-section"><div class="post-label">${t.icon} ${t.label} <span class="hint">${list.length}</span></div>${list.map(entryCardHtml).join('')}</div>`
      })
      .join('')
  }

  function formHtml(): string {
    const selectedType = draft.type
    const info = entryTypeInfo(selectedType)
    return `
      <form id="entry-form" class="entry-form">
        <div class="post-label" style="margin-bottom:6px">✍️ 기록 더하기</div>
        <div class="genre-chips">
          ${ENTRY_TYPES.map((t) => `<button type="button" class="genre-chip entry-type${t.type === selectedType ? ' selected' : ''}" data-type="${t.type}" style="--chip-color:var(--star-yellow)">${t.icon} ${t.label}</button>`).join('')}
        </div>
        ${selectedType === 'photo' ? `
          <label class="photo-pick">
            <input type="file" id="entry-photo" accept="image/*" hidden />
            ${photo ? `<img src="${photo}" alt="고른 사진" />` : '<span>📷 필사한 노트·책 사진 고르기</span>'}
          </label>` : ''}
        <textarea id="entry-text" maxlength="${info.maxLength}" placeholder="${info.placeholder}" style="margin-top:8px; min-height:${selectedType === 'photo' ? 40 : 64}px">${escapeHtml(draft.text)}</textarea>
        ${selectedType === 'quote' ? `<input id="entry-page" placeholder="쪽수(선택, 예: 12-15)" value="${escapeHtml(draft.page)}" style="margin-top:6px" />` : ''}
        ${draft.text ? '<div class="hint draft-hint">💾 쓰던 글을 임시저장해 두었어요</div>' : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:8px">
          <span class="hint" id="entry-msg">${isMine ? '처음 남기는 종류는 별가루를 받고 별이 밝아져요' : '친구 책에 기록을 남기면 별가루를 받아요'}</span>
          <button class="btn" type="submit" id="entry-submit" style="width:auto; margin-top:0; padding:8px 16px">남기기</button>
        </div>
        <p class="error-text" id="entry-error"></p>
      </form>`
  }

  function render() {
    modal.innerHTML = `
      ${headerHtml()}
      <h3 style="margin:22px 0 4px; font-size:15px">📚 기록 <span class="hint">${entries.length}개</span></h3>
      <div id="entry-list">${entriesHtml()}</div>
      ${formHtml()}
    `
    wire()
  }

  async function refresh(changed = true) {
    const [fresh, list] = await Promise.all([getBook(book), listEntries(book)])
    if (fresh) book = fresh
    entries = list
    render()
    if (changed) opts.onChanged?.()
  }

  function wire() {
    modal.querySelector('#post-close')!.addEventListener('click', close)

    modal.querySelector('#post-edit')?.addEventListener('click', () => {
      openEditBook(viewer.classCode, book.studentId, book, () => { void refresh() })
    })

    modal.querySelector('#post-bigstar')?.addEventListener('click', async () => {
      const msg = modal.querySelector<HTMLElement>('#bigstar-msg')!
      if (book.isBigStar) {
        await setBigStar(book, false)
        return refresh()
      }
      // 큰 별은 읽은 책 5권마다 1개씩(1~5권 1개, 6~10권 2개 …)
      const myBooks = await listBooks(book.classCode, book.studentId)
      const limit = Math.max(1, Math.ceil(myBooks.length / 5))
      const used = myBooks.filter((b) => b.isBigStar && b.id !== book.id).length
      if (used >= limit) {
        msg.textContent = `큰 별은 책 5권마다 1개씩 고를 수 있어요(지금 ${limit}개 모두 사용 중). 다른 큰 별을 먼저 해제해 주세요.`
        return
      }
      const reason = prompt('이 책을 큰 별로 고른 이유를 한 줄로 적어주세요 (30자 이내)', '')
      if (reason === null) return
      await setBigStar(book, true, reason)
      await refresh()
    })

    modal.querySelector('#post-delete-book')?.addEventListener('click', async () => {
      if (!confirm(`『${book.title}』 별과 거기 달린 기록을 모두 지울까요? 되돌릴 수 없어요.`)) return
      await deleteBook(book)
      close()
      opts.onChanged?.()
    })

    modal.querySelectorAll<HTMLButtonElement>('.entry-type').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.type = btn.dataset.type as EntryType
        saveDraft(draftKey, draft)
        render()
        modal.querySelector<HTMLTextAreaElement>('#entry-text')!.focus()
      })
    })

    const textEl = modal.querySelector<HTMLTextAreaElement>('#entry-text')!
    const pageEl = modal.querySelector<HTMLInputElement>('#entry-page')
    const persist = () => {
      draft.text = textEl.value
      draft.page = pageEl?.value ?? draft.page
      if (draft.text || draft.page) saveDraft(draftKey, draft)
      else clearDraft(draftKey)
    }
    textEl.addEventListener('input', persist)
    pageEl?.addEventListener('input', persist)

    modal.querySelector<HTMLInputElement>('#entry-photo')?.addEventListener('change', async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (!file) return
      const errorEl = modal.querySelector<HTMLElement>('#entry-error')!
      try {
        errorEl.textContent = '사진을 줄이는 중...'
        photo = await compressImage(file, MAX_IMAGE_LENGTH)
        render()
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err)
      }
    })

    modal.querySelector('#entry-form')!.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const errorEl = modal.querySelector<HTMLElement>('#entry-error')!
      const submitBtn = modal.querySelector<HTMLButtonElement>('#entry-submit')!
      const text = textEl.value
      const page = pageEl?.value ?? ''
      errorEl.textContent = ''
      submitBtn.disabled = true
      try {
        const granted = await addEntry(book, viewer, draft.type, text, page, photo ?? undefined)
        clearDraft(draftKey)
        draft.text = ''
        draft.page = ''
        photo = null
        await refresh()
        modal.querySelector<HTMLElement>('#entry-msg')!.textContent = granted > 0
          ? `✨ 별가루 +${granted}`
          : '기록을 남겼어요(이미 받은 종류이거나 오늘 별가루를 다 모았어요)'
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err)
        submitBtn.disabled = false
      }
    })

    modal.querySelectorAll<HTMLImageElement>('.entry-photo').forEach((img) => {
      img.addEventListener('click', () => img.classList.toggle('zoomed'))
    })

    modal.querySelectorAll<HTMLElement>('.entry-card').forEach((card) => {
      const entry = entries.find((x) => x.id === card.dataset.id)!
      card.querySelector('.entry-edit')?.addEventListener('click', () => { editingId = entry.id; render() })
      card.querySelector('.entry-cancel')?.addEventListener('click', () => { editingId = null; render() })
      card.querySelector('.entry-save')?.addEventListener('click', async () => {
        const text = card.querySelector<HTMLTextAreaElement>('.entry-edit-text')!.value
        const page = card.querySelector<HTMLInputElement>('.entry-edit-page')?.value ?? ''
        try {
          await updateEntry(book, entry, text, page)
          editingId = null
          await refresh()
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err))
        }
      })
      card.querySelector('.entry-card-btn')?.addEventListener('click', () => {
        openQuoteCard({
          classCode: viewer.classCode,
          quote: entry.text,
          page: entry.page,
          title: book.title,
          author: book.author,
          genre: book.genre,
          nickname: entry.authorNickname,
        })
      })
      card.querySelector('.entry-delete')?.addEventListener('click', async () => {
        if (!confirm('이 기록을 지울까요?')) return
        await deleteEntry(book, entry)
        await refresh()
      })
    })
  }

  render()
  modal.querySelector('#entry-list')!.innerHTML = '<p class="hint">불러오는 중...</p>'
  void refresh(false)
  void isTeacherOf(book.classCode).then((yes) => {
    if (!yes || !backdrop.isConnected) return
    teacher = true
    render()
  })
}

/** 사진은 우리가 만든 JPEG data URL만 그린다(다른 주소를 끼워 넣은 기록 방어). */
function safeImage(url?: string): string | null {
  return url && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url) ? url : null
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
