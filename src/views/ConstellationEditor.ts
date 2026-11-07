import type { Book, Student, StarLine, StarPosition, TemplateId } from '../types'
import {
  TEMPLATE_OPTIONS, getTemplateBasePoints, getTemplateConnections, layoutStars,
} from '../three/constellationLayout'
import { saveStarLines, saveStarPositions, setConstellationTemplate } from '../lib/students'

const CANVAS_PX = 480
const UNIT_RANGE = 5 // 좌표 -5~5를 캔버스 0~CANVAS_PX로 매핑

function unitToPx(x: number, y: number): [number, number] {
  const px = ((x + UNIT_RANGE) / (UNIT_RANGE * 2)) * CANVAS_PX
  const py = ((UNIT_RANGE - y) / (UNIT_RANGE * 2)) * CANVAS_PX
  return [px, py]
}

function pxToUnit(px: number, py: number): StarPosition {
  const x = (px / CANVAS_PX) * (UNIT_RANGE * 2) - UNIT_RANGE
  const y = UNIT_RANGE - (py / CANVAS_PX) * (UNIT_RANGE * 2)
  return { x, y }
}

export function openConstellationEditor(
  classCode: string,
  studentId: string,
  student: Student,
  books: Book[],
  onSaved: () => void,
) {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal" style="width:min(560px, 100%)">
      <h2>🪄 별자리 편집</h2>
      <p class="hint" id="editor-hint">별을 끌어서 원하는 자리에 놓아보세요. 연한 파란 선은 템플릿 안내선이에요.</p>

      <div style="display:flex; gap:8px; margin:10px 0">
        <button type="button" class="btn secondary tab-btn active" id="mode-move" style="margin-top:0">✋ 별 옮기기</button>
        <button type="button" class="btn secondary tab-btn" id="mode-link" style="margin-top:0">🔗 별 잇기</button>
        <button type="button" class="btn secondary" id="clear-lines" style="margin-top:0; width:auto; display:none">선 모두 지우기</button>
      </div>

      <label for="editor-template">별자리 템플릿</label>
      <select id="editor-template">
        <optgroup label="유명한 별자리">
          ${TEMPLATE_OPTIONS.filter((t) => t.group === 'famous').map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
        </optgroup>
        <optgroup label="12궁 별자리">
          ${TEMPLATE_OPTIONS.filter((t) => t.group === 'zodiac').map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
        </optgroup>
      </select>

      <div id="editor-canvas" style="position:relative; width:${CANVAS_PX}px; max-width:100%; aspect-ratio:1; margin:16px auto; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden; touch-action:none">
        <canvas id="guide-canvas" width="${CANVAS_PX}" height="${CANVAS_PX}" style="position:absolute; inset:0; width:100%; height:100%"></canvas>
      </div>

      <button type="button" class="btn secondary" id="upload-template-btn" disabled>
        📁 내 별자리 가이드 이미지 올리기 <span class="badge">추가 예정</span>
      </button>

      <div style="display:flex; gap:10px; margin-top:16px">
        <button type="button" class="btn secondary" id="editor-cancel">취소</button>
        <button type="button" class="btn" id="editor-save">저장</button>
      </div>
      <p class="error-text" id="editor-error"></p>
    </div>
  `
  document.body.appendChild(backdrop)

  const close = () => backdrop.remove()
  backdrop.querySelector('#editor-cancel')!.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })

  const canvasWrap = backdrop.querySelector<HTMLElement>('#editor-canvas')!
  const guideCanvas = backdrop.querySelector<HTMLCanvasElement>('#guide-canvas')!
  const templateSelect = backdrop.querySelector<HTMLSelectElement>('#editor-template')!
  templateSelect.value = student.constellationTemplate

  let currentPositions = new Map<string, StarPosition>()
  const savedPositions = student.starPositions ?? {}
  const bookIds = new Set(books.map((b) => b.id))
  let currentLines: StarLine[] = (student.starLines ?? []).filter((l) => bookIds.has(l.a) && bookIds.has(l.b))
  let mode: 'move' | 'link' = 'move'
  let selectedId: string | null = null

  function rebuildPositions(templateId: TemplateId) {
    currentPositions = new Map()
    // 템플릿을 바꾸면 예전 템플릿 기준으로 옮겨둔 좌표는 버리고 새 템플릿 모양으로 다시 배치
    const customArray = templateId === student.constellationTemplate
      ? books.map((b) => savedPositions[b.id])
      : []
    const defaults = layoutStars(templateId, books.length, customArray)
    books.forEach((book, i) => {
      const p = defaults[i]
      currentPositions.set(book.id, { x: p.x, y: p.y })
    })
  }

  function drawGuide(templateId: TemplateId) {
    const ctx = guideCanvas.getContext('2d')!
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX)
    const points = getTemplateBasePoints(templateId)
    const connections = getTemplateConnections(templateId)
    ctx.strokeStyle = 'rgba(143, 180, 255, 0.35)'
    ctx.lineWidth = 2
    for (const [a, b] of connections) {
      if (!points[a] || !points[b]) continue
      const [ax, ay] = unitToPx(points[a][0], points[a][1])
      const [bx, by] = unitToPx(points[b][0], points[b][1])
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(143, 180, 255, 0.5)'
    for (const [px, py] of points) {
      const [x, y] = unitToPx(px, py)
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // 학생이 직접 이은 선(안내선과 구분되게 노란색)
    ctx.strokeStyle = 'rgba(255, 214, 107, 0.9)'
    ctx.lineWidth = 2.5
    for (const { a, b } of currentLines) {
      const pa = currentPositions.get(a)
      const pb = currentPositions.get(b)
      if (!pa || !pb) continue
      const [ax, ay] = unitToPx(pa.x, pa.y)
      const [bx, by] = unitToPx(pb.x, pb.y)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }
  }

  function toggleLine(a: string, b: string) {
    const idx = currentLines.findIndex((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))
    if (idx >= 0) currentLines.splice(idx, 1)
    else currentLines.push({ a, b })
  }

  function handleLinkClick(bookId: string) {
    if (selectedId === null) {
      selectedId = bookId
    } else if (selectedId === bookId) {
      selectedId = null
    } else {
      toggleLine(selectedId, bookId)
      selectedId = null
    }
    redraw()
  }

  function setMode(next: 'move' | 'link') {
    mode = next
    selectedId = null
    backdrop.querySelector('#mode-move')!.classList.toggle('active', mode === 'move')
    backdrop.querySelector('#mode-link')!.classList.toggle('active', mode === 'link')
    backdrop.querySelector<HTMLElement>('#clear-lines')!.style.display = mode === 'link' ? '' : 'none'
    backdrop.querySelector('#editor-hint')!.textContent = mode === 'move'
      ? '별을 끌어서 원하는 자리에 놓아보세요. 연한 파란 선은 템플릿 안내선이에요.'
      : '별 두 개를 차례로 누르면 선이 이어져요. 이미 이어진 두 별을 다시 누르면 선이 지워져요.'
    redraw()
  }

  function redraw() {
    drawGuide(templateSelect.value as TemplateId)
    canvasWrap.querySelectorAll<HTMLElement>('.star-handle').forEach((el) => {
      el.classList.toggle('selected', el.dataset.bookId === selectedId)
    })
  }

  function renderHandles() {
    canvasWrap.querySelectorAll('.star-handle').forEach((el) => el.remove())
    for (const book of books) {
      const pos = currentPositions.get(book.id)!
      const [px, py] = unitToPx(pos.x, pos.y)
      const handle = document.createElement('div')
      handle.className = 'star-handle'
      handle.dataset.bookId = book.id
      handle.title = book.title
      handle.textContent = book.title.slice(0, 1)
      handle.style.left = `${px}px`
      handle.style.top = `${py}px`
      canvasWrap.appendChild(handle)
      wireDrag(handle, book.id)
    }
  }

  function wireDrag(handle: HTMLElement, bookId: string) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (mode === 'link') {
        handleLinkClick(bookId)
        return
      }
      handle.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        const rect = canvasWrap.getBoundingClientRect()
        const scale = CANVAS_PX / rect.width
        const px = Math.min(CANVAS_PX, Math.max(0, (ev.clientX - rect.left) * scale))
        const py = Math.min(CANVAS_PX, Math.max(0, (ev.clientY - rect.top) * scale))
        handle.style.left = `${px}px`
        handle.style.top = `${py}px`
        currentPositions.set(bookId, pxToUnit(px, py))
        if (currentLines.length > 0) drawGuide(templateSelect.value as TemplateId)
      }
      const up = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', up)
    })
  }

  rebuildPositions(student.constellationTemplate)
  drawGuide(student.constellationTemplate)
  renderHandles()

  templateSelect.addEventListener('change', () => {
    const templateId = templateSelect.value as TemplateId
    rebuildPositions(templateId)
    renderHandles()
    redraw()
  })

  backdrop.querySelector('#mode-move')!.addEventListener('click', () => setMode('move'))
  backdrop.querySelector('#mode-link')!.addEventListener('click', () => setMode('link'))
  backdrop.querySelector('#clear-lines')!.addEventListener('click', () => {
    currentLines = []
    selectedId = null
    redraw()
  })

  backdrop.querySelector('#editor-save')!.addEventListener('click', async () => {
    const errorEl = backdrop.querySelector<HTMLElement>('#editor-error')!
    const saveBtn = backdrop.querySelector<HTMLButtonElement>('#editor-save')!
    saveBtn.disabled = true
    try {
      const templateId = templateSelect.value as TemplateId
      if (templateId !== student.constellationTemplate) {
        await setConstellationTemplate(classCode, studentId, templateId)
      }
      const positions: Record<string, StarPosition> = {}
      currentPositions.forEach((v, k) => { positions[k] = v })
      await saveStarPositions(classCode, studentId, positions)
      await saveStarLines(classCode, studentId, currentLines)
      close()
      onSaved()
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      saveBtn.disabled = false
    }
  })
}
