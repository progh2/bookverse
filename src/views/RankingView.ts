import { listClassBooks } from '../lib/books'
import { listStudents } from '../lib/students'
import { state } from '../state'
import { navigate } from '../router'
import type { Student } from '../types'

const MEDALS = ['🥇', '🥈', '🥉']

export async function renderRanking(container: HTMLElement): Promise<void> {
  if (!state.session) {
    navigate('/auth')
    return
  }

  container.innerHTML = `
    <div class="view">
      <div class="panel">
        <h1>🏆 학급 랭킹</h1>
        <p class="hint">별이 많을수록 순위가 올라가요. 별자리를 풍성하게 채워보세요!</p>
        <div id="ranking-list" style="margin-top:16px"><p class="hint">불러오는 중...</p></div>
        <p class="hint" style="margin-top:20px">
          <a href="#/star">내 별자리로 →</a>
          · <a href="#/class">학급 성운으로 →</a>
          · <a href="#/board">게시판으로 →</a>
        </p>
      </div>
    </div>
  `

  const listEl = container.querySelector<HTMLElement>('#ranking-list')!
  const session = state.session

  let students: Student[]
  let bookCountOf: Map<string, number>
  try {
    const [allStudents, books] = await Promise.all([
      listStudents(session.classCode),
      listClassBooks(session.classCode),
    ])
    students = allStudents
    bookCountOf = new Map<string, number>()
    for (const book of books) {
      bookCountOf.set(book.studentId, (bookCountOf.get(book.studentId) ?? 0) + 1)
    }
  } catch (err) {
    console.error(err)
    listEl.innerHTML = '<p class="hint">랭킹을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>'
    return
  }

  if (students.length === 0) {
    listEl.innerHTML = '<p class="hint">아직 학급에 학생이 없어요.</p>'
    return
  }

  const ranked = [...students].sort((a, b) => {
    const starDiff = (bookCountOf.get(b.id) ?? 0) - (bookCountOf.get(a.id) ?? 0)
    if (starDiff !== 0) return starDiff
    return b.starDust - a.starDust
  })

  listEl.innerHTML = ranked
    .map((student, i) => {
      const rank = i + 1
      const starCount = bookCountOf.get(student.id) ?? 0
      const medal = MEDALS[i] ?? ''
      const isMe = student.id === session.studentId
      return `
      <div class="book-row${isMe ? ' ranking-me' : ''}">
        <div>
          <strong>${medal ? `${medal} ` : ''}${rank}위 · ${escapeHtml(student.nickname)}</strong>
          ${isMe ? '<span class="badge">나</span>' : ''}
          <div class="hint">⭐ 별 ${starCount}개 · ✨ 별가루 ${student.starDust}</div>
        </div>
      </div>
    `
    })
    .join('')
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
