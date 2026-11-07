import { StarScene } from '../three/StarScene'
import { layoutStars, layoutClusterCenter } from '../three/constellationLayout'
import { listClassBooks } from '../lib/books'
import { listStudents } from '../lib/students'
import { state } from '../state'
import { navigate } from '../router'
import { openBookDetail } from './BookDetailModal'
import { GENRE_COLORS, type Book, type Student } from '../types'

export async function renderClassNebula(container: HTMLElement): Promise<() => void> {
  if (!state.session) {
    navigate('/auth')
    return () => {}
  }

  container.innerHTML = `
    <div class="view">
      <div class="star-canvas-wrap" id="star-wrap">
        <div class="hud" id="hud">학급 성운을 불러오는 중...</div>
        <div class="hud" id="legend" style="top:auto; bottom:12px; left:12px;"></div>
      </div>
    </div>
  `

  const wrap = container.querySelector<HTMLElement>('#star-wrap')!
  const hud = container.querySelector<HTMLElement>('#hud')!
  const legend = container.querySelector<HTMLElement>('#legend')!

  let books: Book[] = []
  let students: Student[] = []
  const session = state.session

  const scene = new StarScene(wrap, {
    backgroundColor: 0x0a1230,
    cameraPosition: [0, 10, 36],
    onStarClick: (book) => {
      openBookDetail(session.classCode, book, {
        canEdit: book.studentId === session.studentId,
        authorNickname: students.find((s) => s.id === book.studentId)?.nickname ?? '알 수 없음',
      })
    },
  })

  try {
    ;[books, students] = await Promise.all([
      listClassBooks(session.classCode),
      listStudents(session.classCode),
    ])
  } catch (err) {
    hud.innerHTML = `<p class="error-text">학급 성운을 불러오지 못했어요: ${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`
    return () => scene.dispose()
  }

  const byStudent = new Map<string, typeof books>()
  for (const book of books) {
    const list = byStudent.get(book.studentId) ?? []
    list.push(book)
    byStudent.set(book.studentId, list)
  }

  const entries: { book: Book; position: import('three').Vector3 }[] = []
  const positionByBookId = new Map<string, import('three').Vector3>()
  const studentIds = [...byStudent.keys()]
  studentIds.forEach((studentId, idx) => {
    const studentBooks = byStudent.get(studentId)!
    const student = students.find((s) => s.id === studentId)
    const center = layoutClusterCenter(idx, studentIds.length)
    const customPositions = studentBooks.map((b) => student?.starPositions?.[b.id])
    const localPositions = layoutStars(student?.constellationTemplate ?? null, studentBooks.length, customPositions)
    studentBooks.forEach((book, i) => {
      const p = localPositions[i].clone().multiplyScalar(0.6).add(center)
      entries.push({ book, position: p })
      positionByBookId.set(book.id, p)
    })
  })

  scene.setStars(entries)

  // 같은 문장에 밑줄 친 학생끼리 연결선 (정규화한 문장 텍스트가 같은 경우)
  const normalize = (s: string) => s.replace(/\s+/g, '').replace(/["'“”‘’.,!?]/g, '')
  const byQuote = new Map<string, typeof entries>()
  for (const entry of entries) {
    if (!entry.book.quote) continue
    const key = normalize(entry.book.quote)
    if (!key) continue
    const list = byQuote.get(key) ?? []
    list.push(entry)
    byQuote.set(key, list)
  }
  const pairs: [import('three').Vector3, import('three').Vector3][] = []
  for (const list of byQuote.values()) {
    if (list.length < 2) continue
    for (let i = 1; i < list.length; i++) {
      pairs.push([list[0].position, list[i].position])
    }
  }
  // 학생마다 편집기에서 직접 이은 별자리 선도 성운에 함께 그린다
  for (const student of students) {
    for (const { a, b } of student.starLines ?? []) {
      const pa = positionByBookId.get(a)
      const pb = positionByBookId.get(b)
      if (pa && pb) pairs.push([pa, pb])
    }
  }
  scene.setConnections(pairs)

  const ranking = [...students]
    .sort((a, b) => b.starDust - a.starDust)
    .slice(0, 5)

  hud.innerHTML = `
    <div><strong>${state.classRoom?.name ?? '우리 학급'} 성운</strong></div>
    <div>학생 ${students.length}명 · 별 ${books.length}개</div>
    <div style="margin-top:6px">주간 랭킹 Top 5</div>
    <ol style="margin:4px 0 0; padding-left:18px">
      ${ranking.map((s) => `<li>${escapeHtml(s.nickname)} — ${s.starDust}✨</li>`).join('') || '<li>아직 없음</li>'}
    </ol>
    <div style="margin-top:6px; display:flex; gap:10px">
      <a href="#/star" style="color:var(--line-blue)">내 별자리로 →</a>
      <a href="#/board" style="color:var(--line-blue)">게시판 →</a>
    </div>
  `

  legend.innerHTML = Object.entries(GENRE_COLORS)
    .map(([genre, color]) => `<span style="color:#${color.toString(16).padStart(6, '0')}">● ${genre}</span>`)
    .join('&nbsp;&nbsp;')

  return () => scene.dispose()
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
