import { requestCardLines, type CardLines } from '../lib/ai'
import { GENRE_COLORS } from '../types'

interface CardInput {
  classCode: string
  quote: string
  page?: string
  title: string
  author: string
  genre?: string
  nickname: string // 카드에 적히는 이름(문장을 고른 학생 닉네임)
}

type LineKind = 'none' | 'feeling' | 'question' | 'cheer' | 'mine'

const RATIOS = [
  { id: '1:1', label: '정사각 1:1', w: 1080, h: 1080 },
  { id: '4:5', label: '세로 4:5', w: 1080, h: 1350 },
  { id: '9:16', label: '스토리 9:16', w: 1080, h: 1920 },
] as const

const LINE_LABELS: { kind: LineKind; label: string }[] = [
  { kind: 'none', label: '문장만' },
  { kind: 'feeling', label: '💭 감상' },
  { kind: 'question', label: '❓ 질문' },
  { kind: 'cheer', label: '🌱 응원' },
  { kind: 'mine', label: '✏️ 직접 쓰기' },
]

/** 한 소절 카드: 밑줄 친 문장을 별하늘 카드 이미지로 만들어 내려받는다(비율 3종, 문구 버전 3종 + 직접 쓰기). */
export function openQuoteCard(input: CardInput) {
  let ratio: (typeof RATIOS)[number] = RATIOS[0]
  let kind: LineKind = 'feeling'
  let lines: CardLines | null = null
  let mine = ''

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal card-modal">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <h2 style="margin:0">🃏 한 소절 카드</h2>
        <button class="hud-icon-btn" id="card-close" style="font-size:20px" aria-label="닫기">✕</button>
      </div>
      <div class="card-preview"><canvas id="card-canvas"></canvas></div>
      <div class="post-label" style="margin-top:12px">카드 문구</div>
      <div class="genre-chips" id="card-lines"></div>
      <input id="card-mine" maxlength="40" placeholder="카드에 넣을 내 한 줄(40자)" hidden style="margin-top:6px" />
      <p class="hint" id="card-line-hint">AI가 문구를 고르는 중...</p>
      <div class="post-label" style="margin-top:8px">비율</div>
      <div class="genre-chips" id="card-ratios">
        ${RATIOS.map((r) => `<button type="button" class="genre-chip" data-ratio="${r.id}" style="--chip-color:var(--line-blue)">${r.label}</button>`).join('')}
      </div>
      <button class="btn" id="card-download">⬇️ 이미지로 저장</button>
    </div>
  `
  document.body.appendChild(backdrop)
  const close = () => backdrop.remove()
  backdrop.querySelector('#card-close')!.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })

  const canvas = backdrop.querySelector<HTMLCanvasElement>('#card-canvas')!
  const linesEl = backdrop.querySelector<HTMLElement>('#card-lines')!
  const mineInput = backdrop.querySelector<HTMLInputElement>('#card-mine')!
  const hint = backdrop.querySelector<HTMLElement>('#card-line-hint')!

  function currentLine(): string {
    if (kind === 'none') return ''
    if (kind === 'mine') return mine.trim()
    return lines?.[kind] ?? ''
  }

  function renderChips() {
    linesEl.innerHTML = LINE_LABELS.map((l) => `
      <button type="button" class="genre-chip${l.kind === kind ? ' selected' : ''}" data-kind="${l.kind}" style="--chip-color:var(--star-yellow)">${l.label}</button>`).join('')
    linesEl.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => {
      b.addEventListener('click', () => {
        kind = b.dataset.kind as LineKind
        mineInput.hidden = kind !== 'mine'
        if (kind === 'mine') mineInput.focus()
        renderChips()
        draw()
      })
    })
    backdrop.querySelectorAll<HTMLButtonElement>('[data-ratio]').forEach((b) => {
      b.classList.toggle('selected', b.dataset.ratio === ratio.id)
    })
    const line = currentLine()
    if (lines) hint.textContent = line ? `“${line}”` : (kind === 'mine' ? '카드에 넣을 한 줄을 적어 보세요' : '문장만 담은 카드예요')
  }

  function draw() {
    drawCard(canvas, ratio.w, ratio.h, input, currentLine())
  }

  backdrop.querySelectorAll<HTMLButtonElement>('[data-ratio]').forEach((b) => {
    b.addEventListener('click', () => {
      ratio = RATIOS.find((r) => r.id === b.dataset.ratio)!
      renderChips()
      draw()
    })
  })
  mineInput.addEventListener('input', () => { mine = mineInput.value; renderChips(); draw() })

  backdrop.querySelector('#card-download')!.addEventListener('click', () => {
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `한소절_${input.title.replace(/[\\/:*?"<>|\s]+/g, '_')}_${ratio.id.replace(':', 'x')}.png`
    a.click()
  })

  renderChips()
  draw()
  void requestCardLines(input.classCode, input.title, input.author, input.quote).then((res) => {
    lines = res
    if (res.source === 'fallback') hint.textContent = '기본 문구를 보여줘요(AI 문구는 선생님이 AI 키를 설정하면 쓸 수 있어요)'
    renderChips()
    draw()
  })
}

/** 별하늘 배경 + 문장 + 문구 + 책 정보를 캔버스에 그린다. 같은 문장은 늘 같은 별 배치가 나오게 시드를 쓴다. */
function drawCard(canvas: HTMLCanvasElement, w: number, h: number, input: CardInput, line: string) {
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const accent = '#' + (GENRE_COLORS[input.genre ?? '기타'] ?? GENRE_COLORS['기타']).toString(16).padStart(6, '0')

  const bg = ctx.createLinearGradient(0, 0, w * 0.4, h)
  bg.addColorStop(0, '#0b1433')
  bg.addColorStop(0.6, '#1a1f4f')
  bg.addColorStop(1, '#2b1a4a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 은은한 성운
  const neb = ctx.createRadialGradient(w * 0.8, h * 0.18, 0, w * 0.8, h * 0.18, w * 0.7)
  neb.addColorStop(0, hexA(accent, 0.28))
  neb.addColorStop(1, hexA(accent, 0))
  ctx.fillStyle = neb
  ctx.fillRect(0, 0, w, h)

  const rand = seeded(input.quote)
  for (let i = 0; i < 160; i++) {
    const r = rand() < 0.92 ? rand() * 1.8 + 0.4 : rand() * 3 + 2
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.6})`
    ctx.beginPath()
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 오른쪽 위 작은 북두칠성 장식
  const dipper = [[0.70, 0.08], [0.76, 0.10], [0.81, 0.13], [0.86, 0.15], [0.88, 0.21], [0.95, 0.20], [0.94, 0.13]]
  ctx.strokeStyle = 'rgba(143,180,255,0.55)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  dipper.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * w) : ctx.moveTo(x * w, y * w)))
  ctx.lineTo(dipper[3][0] * w, dipper[3][1] * w)
  ctx.stroke()
  for (const [x, y] of dipper) glowDot(ctx, x * w, y * w, 7, '#ffe9a8')

  const pad = w * 0.11
  const maxWidth = w - pad * 2
  ctx.textBaseline = 'top'

  // 큰 따옴표
  ctx.fillStyle = hexA(accent, 0.9)
  ctx.font = `bold ${Math.round(w * 0.16)}px Georgia, serif`
  const quoteTop = h * (h > w * 1.5 ? 0.24 : 0.17)
  ctx.fillText('“', pad - w * 0.02, quoteTop)

  // 문장(길이에 따라 글자 크기를 줄여 카드 안에 들어오게)
  const bodyTop = quoteTop + w * 0.15
  const footerTop = h - w * 0.2
  const lineArea = line ? w * 0.16 : 0
  let size = Math.round(w * 0.058)
  let wrapped: string[] = []
  for (; size >= 28; size -= 2) {
    ctx.font = `600 ${size}px 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`
    wrapped = wrapText(ctx, input.quote, maxWidth)
    if (bodyTop + wrapped.length * size * 1.55 < footerTop - lineArea - w * 0.04) break
  }
  ctx.fillStyle = '#f4f6ff'
  wrapped.forEach((t, i) => ctx.fillText(t, pad, bodyTop + i * size * 1.55))
  let y = bodyTop + wrapped.length * size * 1.55

  if (input.page) {
    ctx.font = `400 ${Math.round(w * 0.026)}px 'Pretendard', sans-serif`
    ctx.fillStyle = 'rgba(244,246,255,0.55)'
    ctx.fillText(`p.${input.page}`, pad, y + w * 0.01)
    y += w * 0.04
  }

  if (line) {
    y += w * 0.04
    ctx.fillStyle = hexA(accent, 0.9)
    ctx.fillRect(pad, y, w * 0.06, 4)
    ctx.font = `500 ${Math.round(w * 0.036)}px 'Pretendard', sans-serif`
    ctx.fillStyle = '#ffe9a8'
    wrapText(ctx, line, maxWidth).slice(0, 2).forEach((t, i) => ctx.fillText(t, pad, y + w * 0.03 + i * w * 0.05))
  }

  // 아래: 책 정보 + 서비스 이름
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(pad, footerTop, maxWidth, 2)
  ctx.font = `700 ${Math.round(w * 0.034)}px 'Pretendard', sans-serif`
  ctx.fillStyle = '#f4f6ff'
  ctx.fillText(ellipsis(ctx, `『${input.title}』`, maxWidth), pad, footerTop + w * 0.03)
  ctx.font = `400 ${Math.round(w * 0.027)}px 'Pretendard', sans-serif`
  ctx.fillStyle = 'rgba(244,246,255,0.7)'
  ctx.fillText(ellipsis(ctx, `${input.author} · ${input.nickname}의 밑줄`, maxWidth * 0.68), pad, footerTop + w * 0.085)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffd66b'
  ctx.fillText('★ Book두칠성', w - pad, footerTop + w * 0.085)
  ctx.textAlign = 'left'
}

/** 한국어는 띄어쓰기 단위로 줄을 나누고, 한 단어가 너무 길면 글자 단위로 자른다. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let cur = ''
    for (const word of para.split(/(\s+)/)) {
      const next = cur + word
      if (ctx.measureText(next).width <= maxWidth) { cur = next; continue }
      if (cur.trim()) out.push(cur.trim())
      cur = ''
      for (const ch of word.trimStart()) {
        if (ctx.measureText(cur + ch).width > maxWidth) { out.push(cur); cur = '' }
        cur += ch
      }
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
  g.addColorStop(0, color)
  g.addColorStop(0.3, hexA(color, 0.6))
  g.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 3, 0, Math.PI * 2)
  ctx.fill()
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
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
