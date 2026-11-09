import { applyStarStyle, buyShopItem } from '../lib/students'
import { dustBalance, SHOP_ITEMS, SLOT_LABELS, type ShopItem, type ShopSlot } from '../shop'
import { getShapeTexture } from '../three/starTexture'
import type { StarStyle, Student } from '../types'

/** 별가루 상점: 별 모양·별자리 선 색·별 윤곽 변경권을 사고, 산 것은 언제든 바꿔 끼운다. */
export function openShop(initial: Student, onChanged: (student: Student) => void) {
  let student = initial
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `<div class="modal shop-modal" id="shop-modal"></div>`
  document.body.appendChild(backdrop)
  const modal = backdrop.querySelector<HTMLElement>('#shop-modal')!
  const close = () => backdrop.remove()
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  let message = ''

  function render() {
    const owned = new Set(student.ownedItems ?? [])
    const style = student.starStyle ?? {}
    const balance = dustBalance(student)
    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center">
        <h2 style="margin:0">🛍 별가루 상점</h2>
        <button class="hud-icon-btn" id="shop-close" style="font-size:20px" aria-label="닫기">✕</button>
      </div>
      <p class="hint">남은 별가루 <strong class="shop-balance">✨ ${balance}</strong> · 모은 별가루 ${student.starDust}
        <br/>상점에서 써도 랭킹(모은 별가루)은 줄지 않아요. 산 꾸미기는 내 별자리와 학급 성운에 함께 보여요.</p>
      <p class="hint shop-msg" aria-live="polite">${message}</p>
      ${(Object.keys(SLOT_LABELS) as ShopSlot[]).map((slot) => `
        <div class="post-label" style="margin-top:14px">${SLOT_LABELS[slot]}
          ${style[slot] ? `<button class="hud-icon-btn shop-reset" data-slot="${slot}">기본으로 되돌리기</button>` : '<span class="hint">기본 사용 중</span>'}
        </div>
        <div class="shop-grid">
          ${SHOP_ITEMS.filter((i) => i.slot === slot).map((item) => itemHtml(item, owned.has(item.id), style[slot] === item.id, balance)).join('')}
        </div>`).join('')}
    `
    modal.querySelector('#shop-close')!.addEventListener('click', close)
    modal.querySelectorAll<HTMLButtonElement>('.shop-buy').forEach((btn) => btn.addEventListener('click', async () => {
      const item = SHOP_ITEMS.find((i) => i.id === btn.dataset.id)!
      if (!confirm(`별가루 ${item.price}으로 '${item.name}'을(를) 살까요?`)) return
      btn.disabled = true
      try {
        student = await buyShopItem(student.classCode, student.id, item.id)
        message = `✨ '${item.name}'을(를) 사서 바로 적용했어요!`
        onChanged(student)
      } catch (err) {
        message = err instanceof Error ? err.message : String(err)
      }
      render()
    }))
    modal.querySelectorAll<HTMLButtonElement>('.shop-apply').forEach((btn) => btn.addEventListener('click', async () => {
      const item = SHOP_ITEMS.find((i) => i.id === btn.dataset.id)!
      await saveStyle({ ...student.starStyle, [item.slot]: item.id })
      message = `'${item.name}' 적용!`
      render()
    }))
    modal.querySelectorAll<HTMLButtonElement>('.shop-reset').forEach((btn) => btn.addEventListener('click', async () => {
      const next: StarStyle = { ...student.starStyle }
      delete next[btn.dataset.slot as ShopSlot]
      await saveStyle(next)
      message = '기본 모양으로 되돌렸어요.'
      render()
    }))
  }

  async function saveStyle(style: StarStyle) {
    await applyStarStyle(student.classCode, student.id, style)
    student = { ...student, starStyle: style }
    onChanged(student)
  }

  render()
}

function itemHtml(item: ShopItem, owned: boolean, applied: boolean, balance: number): string {
  const action = applied
    ? '<span class="badge">적용 중</span>'
    : owned
      ? `<button class="btn secondary shop-apply" data-id="${item.id}">적용</button>`
      : `<button class="btn shop-buy" data-id="${item.id}" ${balance < item.price ? 'disabled' : ''}>✨ ${item.price}</button>`
  return `
    <div class="shop-item${applied ? ' applied' : ''}">
      <div class="shop-preview">${previewHtml(item)}</div>
      <strong>${item.name}</strong>
      <span class="hint">${item.description}</span>
      ${action}
    </div>`
}

function previewHtml(item: ShopItem): string {
  if (item.slot === 'shape') {
    const canvas = getShapeTexture(item.value).image as HTMLCanvasElement
    return `<img src="${canvas.toDataURL()}" alt="" style="filter: drop-shadow(0 0 6px #ffd66b) sepia(1) saturate(4) hue-rotate(5deg)" />`
  }
  const color = item.value === 'rainbow' ? 'url(#rb)' : item.value
  const defs = item.value === 'rainbow'
    ? '<defs><linearGradient id="rb"><stop offset="0" stop-color="#ff6b8a"/><stop offset=".33" stop-color="#ffd66b"/><stop offset=".66" stop-color="#6bffd6"/><stop offset="1" stop-color="#8fb4ff"/></linearGradient></defs>'
    : ''
  if (item.slot === 'lineColor') {
    return `<svg viewBox="0 0 64 40" width="64" height="40">${defs}
      <polyline points="6,30 22,12 40,22 58,8" fill="none" stroke="${color}" stroke-width="2.5"/>
      ${[[6, 30], [22, 12], [40, 22], [58, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff"/>`).join('')}</svg>`
  }
  return `<svg viewBox="0 0 40 40" width="40" height="40">${defs}
    <circle cx="20" cy="20" r="14" fill="none" stroke="${color}" stroke-width="2.5"/><circle cx="20" cy="20" r="5" fill="#fff"/></svg>`
}
