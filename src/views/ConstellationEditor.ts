import type { Book, Student, StarPosition, TemplateId } from '../types'
import {
  TEMPLATE_OPTIONS, getTemplateBasePoints, getTemplateConnections, layoutStars,
} from '../three/constellationLayout'
import { saveStarPositions, setConstellationTemplate } from '../lib/students'

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
      <p class="hint">별을 끌어서 원하는 자리에 놓아보세요. 연한 선은 템플릿 안내선이에요.</p>

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

  function rebuildPositions(templateId: TemplateId) {
    currentPositions = new Map()
    const customArray = books.map((b) => savedPositions[b.id])
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
  }

  function renderHandles() {
    canvasWrap.querySelectorAll('.star-handle').forEach((el) => el.remove())
    for (const book of books) {
      const pos = currentPositions.get(book.id)!
      const [px, py] = unitToPx(pos.x, pos.y)
      const handle = document.createElement('div')
      handle.className = 'star-handle'
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
      handle.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        const rect = canvasWrap.getBoundingClientRect()
        const scale = CANVAS_PX / rect.width
        const px = Math.min(CANVAS_PX, Math.max(0, (ev.clientX - rect.left) * scale))
        const py = Math.min(CANVAS_PX, Math.max(0, (ev.clientY - rect.top) * scale))
        handle.style.left = `${px}px`
        handle.style.top = `${py}px`
        currentPositions.set(bookId, pxToUnit(px, py))
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
    drawGuide(templateId)
    renderHandles()
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
      close()
      onSaved()
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      saveBtn.disabled = false
    }
  })
}
