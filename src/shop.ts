import type { StarStyle } from './types'

export type ShopSlot = 'shape' | 'lineColor' | 'outline'

export interface ShopItem {
  id: string
  slot: ShopSlot
  name: string
  price: number
  value: string // shape: 텍스처 이름 / lineColor·outline: '#rrggbb' 또는 'rainbow'
  description: string
}

/** 별가루 상점 물건(모양·별자리 선 색·윤곽 변경권). 한 번 사면 계속 바꿔 끼울 수 있다. */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'shape-sparkle', slot: 'shape', name: '반짝이 별', price: 30, value: 'sparkle', description: '네 갈래로 반짝이는 별' },
  { id: 'shape-star5', slot: 'shape', name: '오각 별', price: 30, value: 'star5', description: '그림책 속 뾰족한 별' },
  { id: 'shape-diamond', slot: 'shape', name: '다이아 별', price: 35, value: 'diamond', description: '보석처럼 빛나는 별' },
  { id: 'shape-heart', slot: 'shape', name: '하트 별', price: 40, value: 'heart', description: '마음에 남은 책들을 하트로' },
  { id: 'line-gold', slot: 'lineColor', name: '금빛 선', price: 20, value: '#ffd66b', description: '별자리 선을 금빛으로' },
  { id: 'line-pink', slot: 'lineColor', name: '벚꽃 선', price: 20, value: '#ff9fc2', description: '별자리 선을 분홍빛으로' },
  { id: 'line-mint', slot: 'lineColor', name: '민트 선', price: 20, value: '#6bffd6', description: '별자리 선을 민트빛으로' },
  { id: 'line-violet', slot: 'lineColor', name: '보랏빛 선', price: 20, value: '#c39bff', description: '별자리 선을 보랏빛으로' },
  { id: 'outline-silver', slot: 'outline', name: '은빛 윤곽', price: 25, value: '#dfe6ff', description: '별마다 은빛 고리' },
  { id: 'outline-gold', slot: 'outline', name: '금빛 윤곽', price: 35, value: '#ffd66b', description: '별마다 금빛 고리' },
  { id: 'outline-rainbow', slot: 'outline', name: '무지개 윤곽', price: 50, value: 'rainbow', description: '색이 천천히 바뀌는 고리' },
]

export const SLOT_LABELS: Record<ShopSlot, string> = {
  shape: '⭐ 별 모양',
  lineColor: '〰️ 별자리 선 색',
  outline: '⭕ 별 윤곽',
}

export const DEFAULT_LINE_COLOR = 0x8fb4ff

export function shopItem(id: string | undefined): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id)
}

/** 적용 중인 꾸미기를 그리기용 값으로 푼다. */
export function resolveStarStyle(style: StarStyle | undefined) {
  const shape = shopItem(style?.shape)?.value
  const line = shopItem(style?.lineColor)?.value
  const outline = shopItem(style?.outline)?.value
  return {
    shape,
    lineColor: line ? parseInt(line.slice(1), 16) : DEFAULT_LINE_COLOR,
    outline: outline === 'rainbow' ? ('rainbow' as const) : outline ? parseInt(outline.slice(1), 16) : null,
  }
}

export type ResolvedStarStyle = ReturnType<typeof resolveStarStyle>

export function dustBalance(student: { starDust: number; starDustSpent?: number }): number {
  return Math.max(0, student.starDust - (student.starDustSpent ?? 0))
}
