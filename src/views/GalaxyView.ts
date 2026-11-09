import * as THREE from 'three'
import { collectionGroup, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { StarScene } from '../three/StarScene'
import { getClass } from '../lib/classes'
import { state } from '../state'
import { computeBrightness, GENRE_COLORS, type Book } from '../types'

const ROTATE_SPEED = 0.018

interface ClassStat {
  code: string
  name: string
  books: Book[]
  students: number
  topGenre: string
  avgBrightness: number
  quotes: number
  center: THREE.Vector3
}

/**
 * 은하 화면: 여러 학급의 성운을 하나의 나선 은하로 모아 비교한다.
 * 다른 학급 학생은 이름을 보여주지 않고(책과 학급만), 학급별 통계를 나란히 놓는다.
 */
export async function renderGalaxy(container: HTMLElement): Promise<() => void> {
  container.innerHTML = `
    <div class="view">
      <div class="star-canvas-wrap" id="star-wrap">
        <div class="hud galaxy-hud" id="hud">은하를 불러오는 중...</div>
        <div class="hud galaxy-pick" id="pick" hidden></div>
      </div>
    </div>
  `
  const wrap = container.querySelector<HTMLElement>('#star-wrap')!
  const hud = container.querySelector<HTMLElement>('#hud')!
  const pick = container.querySelector<HTMLElement>('#pick')!

  let books: Book[]
  try {
    const snap = await getDocs(collectionGroup(db, 'books'))
    books = snap.docs.map((d) => ({ ...(d.data() as Omit<Book, 'id'>), id: d.id }))
  } catch (err) {
    hud.innerHTML = `<p class="error-text">은하를 불러오지 못했어요: ${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`
    return () => {}
  }

  const byClass = new Map<string, Book[]>()
  for (const b of books) {
    if (!b.classCode) continue
    byClass.set(b.classCode, [...(byClass.get(b.classCode) ?? []), b])
  }
  // 별이 많은 학급부터 은하 안쪽에 놓는다
  const codes = [...byClass.keys()].sort((a, b) => byClass.get(b)!.length - byClass.get(a)!.length)
  const classes = await Promise.all(codes.map((code) => getClass(code).catch(() => null)))
  const myCode = state.session?.classCode

  // 데모 학급처럼 이름이 같은 학급은 코드를 붙여 구분한다
  const nameCount = new Map<string, number>()
  classes.forEach((c, i) => { const n = c?.name ?? codes[i]; nameCount.set(n, (nameCount.get(n) ?? 0) + 1) })
  const stats: ClassStat[] = codes.map((code, i) => {
    const list = byClass.get(code)!
    const genres = new Map<string, number>()
    for (const b of list) genres.set(b.genre ?? '기타', (genres.get(b.genre ?? '기타') ?? 0) + 1)
    // 황금각 나선: 학급이 몇 개든 겹치지 않고 은하 팔처럼 퍼진다
    const r = 5 + Math.sqrt(i) * 7
    const a = i * 2.39996
    return {
      code,
      name: (nameCount.get(classes[i]?.name ?? code) ?? 0) > 1 ? `${classes[i]?.name} · ${code}` : (classes[i]?.name ?? code),
      books: list,
      students: new Set(list.map((b) => b.studentId)).size,
      topGenre: [...genres.entries()].sort((x, y) => y[1] - x[1])[0][0],
      avgBrightness: list.reduce((s, b) => s + computeBrightness(b), 0) / list.length,
      quotes: list.reduce((s, b) => s + (b.entryCounts?.quote ?? 0), 0),
      center: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0),
    }
  })

  const outer = stats.length ? Math.max(...stats.map((s) => s.center.length())) + 6 : 10
  const scene = new StarScene(wrap, {
    backgroundColor: 0x070c22,
    cameraPosition: [0, 0, outer * 2.1],
    autoRotateSpeed: ROTATE_SPEED,
    centerGlow: true,
    onStarClick: (book) => {
      const cls = stats.find((s) => s.code === book.classCode)
      pick.hidden = false
      pick.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:8px">
          <strong>⭐ ${escapeHtml(book.title)}</strong>
          <button class="hud-icon-btn" id="pick-close" aria-label="닫기">✕</button>
        </div>
        <div class="hint">${escapeHtml(book.author)} · ${escapeHtml(book.genre ?? '기타')} · 밝기 ${computeBrightness(book)}/5</div>
        <div class="hint">${escapeHtml(cls?.name ?? '')} 성운의 별${book.classCode === myCode ? ' · <a href="#/class">우리 학급 성운에서 보기 →</a>' : ''}</div>`
      pick.querySelector('#pick-close')!.addEventListener('click', () => { pick.hidden = true })
    },
  })

  const entries: { book: Book; position: THREE.Vector3 }[] = []
  const dust: { position: THREE.Vector3; color: number }[] = []
  for (const cls of stats) {
    const spread = 1.2 + Math.sqrt(cls.books.length) * 0.55
    cls.books.forEach((book) => {
      const rand = seeded(book.id)
      // 가운데가 촘촘한 원반 모양으로 흩뿌린다
      const rr = spread * Math.sqrt(rand()) * (0.4 + rand() * 0.6)
      const aa = rand() * Math.PI * 2
      entries.push({ book, position: new THREE.Vector3(cls.center.x + Math.cos(aa) * rr, cls.center.y + Math.sin(aa) * rr, (rand() - 0.5) * 0.6) })
    })
    const color = GENRE_COLORS[cls.topGenre] ?? GENRE_COLORS['기타']
    const rand = seeded(cls.code)
    for (let k = 0; k < 140; k++) {
      const rr = spread * 1.8 * Math.sqrt(rand())
      const aa = rand() * Math.PI * 2
      dust.push({ position: new THREE.Vector3(cls.center.x + Math.cos(aa) * rr, cls.center.y + Math.sin(aa) * rr, 0), color })
    }
  }

  // 학급 사이를 잇는 두 줄기 나선 팔(배경 빛 알갱이)
  const armRand = seeded('galaxy')
  for (let k = 0; k < 1400; k++) {
    const arm = k % 2
    const t = armRand()
    const r = 1.5 + t * outer
    const a = arm * Math.PI + t * 4.2 + (armRand() - 0.5) * 0.5
    dust.push({
      position: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, (armRand() - 0.5) * 0.8),
      color: armRand() < 0.7 ? 0x8fb4ff : 0xffe9b0,
    })
  }

  scene.setDust(dust, 0.18)
  scene.setStars(entries)
  scene.setNebulae(stats.map((cls) => ({
    position: cls.center.clone(),
    color: GENRE_COLORS[cls.topGenre] ?? GENRE_COLORS['기타'],
    size: 6 + Math.sqrt(cls.books.length) * 1.6,
  })))
  const labelScale = Math.max(1, outer / 10)
  scene.setLabels(stats.map((cls) => ({
    text: `${cls.code === myCode ? '★ ' : ''}${cls.name}`,
    position: cls.center.clone().add(new THREE.Vector3(0, -(2.6 + Math.sqrt(cls.books.length) * 0.55), 0)),
  })), labelScale)

  const maxBooks = Math.max(1, ...stats.map((s) => s.books.length))
  hud.innerHTML = `
    <div><strong>🌌 Book두칠성 은하</strong></div>
    <div class="hint">학급 ${stats.length}개 · 별 ${books.length}개 — 성운 하나가 학급 하나예요</div>
    <details class="hud-fold" ${window.innerWidth > 700 ? 'open' : ''}>
    <summary>학급 비교표</summary>
    <table class="galaxy-table">
      <thead><tr><th>학급</th><th>별</th><th>1인당</th><th>평균 밝기</th><th>문장</th><th>많이 읽은 장르</th></tr></thead>
      <tbody>
        ${stats.map((s) => `
          <tr class="${s.code === myCode ? 'mine' : ''}">
            <td>${s.code === myCode ? '★ ' : ''}${escapeHtml(s.name)}<div class="galaxy-bar" style="width:${Math.round((s.books.length / maxBooks) * 100)}%"></div></td>
            <td>${s.books.length}</td>
            <td>${(s.books.length / Math.max(1, s.students)).toFixed(1)}</td>
            <td>${s.avgBrightness.toFixed(1)}</td>
            <td>${s.quotes}</td>
            <td><span style="color:#${(GENRE_COLORS[s.topGenre] ?? GENRE_COLORS['기타']).toString(16).padStart(6, '0')}">● ${s.topGenre}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="hint" style="margin-top:6px">별을 누르면 어떤 책인지 볼 수 있어요. 다른 학급 친구의 이름은 보이지 않아요.</div>
    </details>
  `

  return () => scene.dispose()
}

function seeded(text: string): () => number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
