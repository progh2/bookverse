import { StarScene } from '../three/StarScene'
import { layoutStars, layoutClusterCenter } from '../three/constellationLayout'
import { listClassBooks } from '../lib/books'
import { listStudents } from '../lib/students'
import { state } from '../state'
import { navigate } from '../router'
import { GENRE_COLORS } from '../types'

export async function renderClassNebula(container: HTMLElement): Promise<() => void> {
  if (!state.session) {
    navigate('/join')
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

  const scene = new StarScene(wrap, { backgroundColor: 0x0a1230 })
  scene.camera.position.set(0, 10, 36)

  const [books, students] = await Promise.all([
    listClassBooks(state.session.classCode),
    listStudents(state.session.classCode),
  ])

  const byStudent = new Map<string, typeof books>()
  for (const book of books) {
    const list = byStudent.get(book.studentId) ?? []
    list.push(book)
    byStudent.set(book.studentId, list)
  }

  const entries: { book: (typeof books)[number]; position: import('three').Vector3 }[] = []
  const studentIds = [...byStudent.keys()]
  studentIds.forEach((studentId, idx) => {
    const studentBooks = byStudent.get(studentId)!
    const student = students.find((s) => s.id === studentId)
    const center = layoutClusterCenter(idx, studentIds.length)
    const localPositions = layoutStars(student?.zodiac ?? null, studentBooks.length)
    studentBooks.forEach((book, i) => {
      const p = localPositions[i].clone().multiplyScalar(0.6).add(center)
      entries.push({ book, position: p })
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
    <div style="margin-top:6px"><a href="#/star" style="color:var(--line-blue)">내 별자리로 돌아가기 →</a></div>
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
