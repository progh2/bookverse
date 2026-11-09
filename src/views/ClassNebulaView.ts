import type * as THREE from 'three'
import { StarScene } from '../three/StarScene'
import {
  defaultStarLines, layoutClusterCenter, layoutStars, nebulaRingRadius,
} from '../three/constellationLayout'
import { listClassBooks } from '../lib/books'
import { listStudents } from '../lib/students'
import { state } from '../state'
import { navigate } from '../router'
import { openBookPost } from './BookPostModal'
import { GENRE_COLORS, type Book, type Student } from '../types'
import { characterIdFor, characterSvg } from '../characters'
import { resolveStarStyle } from '../shop'

const CLUSTER_SCALE = 0.7 // 학생 한 명의 별자리를 원 위에 올릴 때의 축소 비율
const ROTATE_SPEED = 0.025 // rad/s — 한 바퀴 약 4분

export async function renderClassNebula(container: HTMLElement): Promise<() => void> {
  if (!state.session) {
    navigate('/auth')
    return () => {}
  }
  const session = state.session

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

  let books: Book[]
  let students: Student[]
  try {
    ;[books, students] = await Promise.all([
      listClassBooks(session.classCode),
      listStudents(session.classCode),
    ])
  } catch (err) {
    hud.innerHTML = `<p class="error-text">학급 성운을 불러오지 못했어요: ${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`
    return () => {}
  }

  const byStudent = new Map<string, Book[]>()
  for (const book of books) {
    const list = byStudent.get(book.studentId) ?? []
    list.push(book)
    byStudent.set(book.studentId, list)
  }
  const studentIds = [...byStudent.keys()]
  const radius = nebulaRingRadius(studentIds.length)
  const cameraDistance = 2.2 * (radius + 4) // 원과 바깥 이름표까지 화면에 다 들어오는 거리

  const scene = new StarScene(wrap, {
    backgroundColor: 0x0a1230,
    cameraPosition: [0, 0, cameraDistance],
    autoRotateSpeed: ROTATE_SPEED,
    centerGlow: true,
    onStarClick: (book) => {
      // 친구 별이어도 같은 상세 화면에서 기록을 더하거나(내 기록은) 고칠 수 있다
      openBookPost(book, {
        authorNickname: students.find((s) => s.id === book.studentId)?.nickname ?? '알 수 없음',
        viewer: session,
      })
    },
  })

  const entries: { book: Book; position: THREE.Vector3; style: ReturnType<typeof resolveStarStyle> }[] = []
  const solidPairs: [THREE.Vector3, THREE.Vector3, number][] = []
  const labels: { text: string; position: THREE.Vector3 }[] = []
  const nebulae: { position: THREE.Vector3; color: number; size: number }[] = []
  const avatars: { svg: string; position: THREE.Vector3; size: number }[] = []
  const labelScale = Math.max(1, cameraDistance / 24)

  studentIds.forEach((studentId, idx) => {
    const studentBooks = byStudent.get(studentId)!
    const student = students.find((s) => s.id === studentId)
    const template = student?.constellationTemplate ?? null
    const center = layoutClusterCenter(idx, studentIds.length)
    const customPositions = studentBooks.map((b) => student?.starPositions?.[b.id])
    const localPositions = layoutStars(template, studentBooks.length, customPositions)

    // 별자리 모양의 중심을 원 위의 자리에 맞춰야 이웃 별자리와 겹치지 않는다
    const cx = localPositions.reduce((s, p) => s + p.x, 0) / localPositions.length
    const cy = localPositions.reduce((s, p) => s + p.y, 0) / localPositions.length

    const worldById = new Map<string, THREE.Vector3>()
    const style = resolveStarStyle(student?.starStyle) // 상점에서 산 꾸미기를 성운에서도 보여 준다
    studentBooks.forEach((book, i) => {
      const p = localPositions[i].clone()
      p.x -= cx
      p.y -= cy
      p.multiplyScalar(CLUSTER_SCALE).add(center)
      entries.push({ book, position: p, style })
      worldById.set(book.id, p)
    })

    // 학생이 직접 이은 선이 없으면 템플릿 모양대로 기본 선을 이어 별자리로 보이게 한다
    const lines = student?.starLines
      ?? defaultStarLines(template, studentBooks.map((b) => b.id), localPositions)
    for (const { a, b } of lines) {
      const pa = worldById.get(a)
      const pb = worldById.get(b)
      if (pa && pb) solidPairs.push([pa, pb, style.lineColor])
    }

    // 원 바깥쪽으로 캐릭터 → 그 바깥에 닉네임 순서로 놓는다(원이 돌아도 항상 바깥을 향함)
    const avatarPos = center.clone().setLength(radius + 3.0)
    avatarPos.z = center.z
    avatars.push({ svg: characterSvg(characterIdFor(student), 200), position: avatarPos, size: 1.15 * labelScale })
    const labelPos = center.clone().setLength(radius + 3.0 + 1.3 * labelScale)
    labelPos.z = center.z
    labels.push({ text: student?.nickname ?? '알 수 없음', position: labelPos })

    // 가장 많이 읽은 장르 색으로 그 학생 별자리 뒤에 은은한 성운을 깐다
    const genreCount = new Map<string, number>()
    for (const b of studentBooks) genreCount.set(b.genre ?? '기타', (genreCount.get(b.genre ?? '기타') ?? 0) + 1)
    const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
    nebulae.push({ position: center.clone(), color: GENRE_COLORS[topGenre] ?? GENRE_COLORS['기타'], size: 7 + Math.min(studentBooks.length, 10) * 0.4 })
  })

  scene.setStars(entries)
  scene.setConnections(solidPairs)
  // 원이 클수록 카메라가 멀어져 글씨가 작아지므로 그만큼 이름표를 키운다
  scene.setNebulae(nebulae)
  scene.setAvatars(avatars)
  scene.setLabels(labels, labelScale)

  // 같은 문장에 밑줄 친 서로 다른 학생끼리는 연한 점선으로 느슨하게 잇는다
  // (책마다 남긴 문장들의 정규화 키 quoteKeys를 책 문서에 함께 저장해 두므로 기록을 따로 읽지 않아도 된다)
  const byQuote = new Map<string, typeof entries>()
  for (const entry of entries) {
    for (const key of new Set(entry.book.quoteKeys ?? [])) {
      if (!key) continue
      const list = byQuote.get(key) ?? []
      list.push(entry)
      byQuote.set(key, list)
    }
  }
  const dashedPairs: [THREE.Vector3, THREE.Vector3][] = []
  for (const list of byQuote.values()) {
    for (let i = 1; i < list.length; i++) {
      if (list[i].book.studentId === list[0].book.studentId) continue
      dashedPairs.push([list[0].position, list[i].position])
    }
  }
  scene.setDashedConnections(dashedPairs)

  const ranking = [...students].sort((a, b) => b.starDust - a.starDust).slice(0, 5)

  hud.innerHTML = `
    <div><strong>${escapeHtml(state.classRoom?.name ?? '우리 학급')} 성운</strong></div>
    <div>학생 ${studentIds.length}명 · 별 ${books.length}개</div>
    <details class="hud-fold" ${window.innerWidth > 700 ? 'open' : ''}>
      <summary>안내 · 랭킹 Top 5</summary>
      <div class="hint" style="margin-top:4px">별을 누르면 책과 읽은 친구를 볼 수 있어요<br/>노란 점선: 같은 문장에 밑줄 친 친구</div>
      <ol style="margin:4px 0 0; padding-left:18px">
        ${ranking.map((s) => `<li>${escapeHtml(s.nickname)} — ${s.starDust}✨</li>`).join('') || '<li>아직 없음</li>'}
      </ol>
    </details>
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
