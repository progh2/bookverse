import * as THREE from 'three'
import type { TemplateId, ZodiacSign, FamousConstellationId, StarPosition } from '../types'

const ZODIAC_SEEDS: Record<ZodiacSign, number> = {
  aries: 1, taurus: 2, gemini: 3, cancer: 4, leo: 5, virgo: 6,
  libra: 7, scorpio: 8, sagittarius: 9, capricorn: 10, aquarius: 11, pisces: 12,
}

const ZODIAC_LABELS_KO: Record<ZodiacSign, string> = {
  aries: '양자리', taurus: '황소자리', gemini: '쌍둥이자리', cancer: '게자리',
  leo: '사자자리', virgo: '처녀자리', libra: '천칭자리', scorpio: '전갈자리',
  sagittarius: '궁수자리', capricorn: '염소자리', aquarius: '물병자리', pisces: '물고기자리',
}

const FAMOUS_LABELS_KO: Record<FamousConstellationId, string> = {
  big_dipper: '북두칠성',
  orion: '오리온자리',
  cassiopeia: '카시오페이아',
  cygnus: '백조자리(북십자성)',
}

// 실제 천문 좌표가 아니라 눈에 익은 모양을 단순화해 손으로 잡은 기준점(-3~3 범위).
const FAMOUS_POINTS: Record<FamousConstellationId, [number, number][]> = {
  big_dipper: [
    [-3.2, 0.6], [-2.1, 1.1], [-1.0, 1.0], [0.1, 0.8],
    [0.3, -0.3], [1.8, -0.4], [1.6, 0.9],
  ],
  orion: [
    [-1.8, 2.2], [1.8, 2.0], [-0.6, 0.3], [0.0, 0.0],
    [0.6, -0.3], [-1.6, -2.3], [1.7, -2.1],
  ],
  cassiopeia: [
    [-2.4, -0.5], [-1.2, 1.0], [0.0, -0.3], [1.2, 1.0], [2.4, -0.6],
  ],
  cygnus: [
    [0, 2.4], [0, 0.6], [0, -2.2], [-2.0, 0.6], [2.0, 0.6],
  ],
}

// 안내선 연결(없으면 순서대로 이어 그린다)
const FAMOUS_CONNECTIONS: Partial<Record<FamousConstellationId, [number, number][]>> = {
  big_dipper: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  cygnus: [[0, 1], [1, 2], [3, 1], [1, 4]],
}

export const TEMPLATE_OPTIONS: { id: TemplateId; label: string; group: 'famous' | 'zodiac' }[] = [
  ...(Object.keys(FAMOUS_LABELS_KO) as FamousConstellationId[]).map((id) => ({
    id, label: FAMOUS_LABELS_KO[id], group: 'famous' as const,
  })),
  ...(Object.keys(ZODIAC_LABELS_KO) as ZodiacSign[]).map((id) => ({
    id, label: ZODIAC_LABELS_KO[id], group: 'zodiac' as const,
  })),
]

export function templateLabel(id: TemplateId): string {
  return (FAMOUS_LABELS_KO as Record<string, string>)[id] ?? (ZODIAC_LABELS_KO as Record<string, string>)[id] ?? id
}

export function isFamousTemplate(id: TemplateId): id is FamousConstellationId {
  return id in FAMOUS_POINTS
}

/** 결정적 의사난수(시드 고정 — 같은 템플릿은 항상 같은 모양). */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE_OUTLINE_COUNT = 7

/** 템플릿의 기준 윤곽점(최대 7개, 편집기 가이드선과 기본 배치가 함께 쓴다). */
export function getTemplateBasePoints(templateId: TemplateId): [number, number][] {
  if (isFamousTemplate(templateId)) return FAMOUS_POINTS[templateId]

  const seed = ZODIAC_SEEDS[templateId as ZodiacSign] * 97
  const rand = mulberry32(seed)
  const points: [number, number][] = []
  for (let i = 0; i < BASE_OUTLINE_COUNT; i++) {
    const angle = (i / BASE_OUTLINE_COUNT) * Math.PI * 2 + rand() * 0.6
    const radius = 2.2 + rand() * 1.2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * 0.7 + (rand() - 0.5) * 1.2
    points.push([x, y])
  }
  return points
}

/** 편집기에서 가이드선을 그릴 때 쓰는 연결(점 인덱스 쌍). 지정 없으면 순서대로 잇는다. */
export function getTemplateConnections(templateId: TemplateId): [number, number][] {
  if (isFamousTemplate(templateId) && FAMOUS_CONNECTIONS[templateId]) {
    return FAMOUS_CONNECTIONS[templateId]!
  }
  const points = getTemplateBasePoints(templateId)
  const lines: [number, number][] = []
  for (let i = 0; i < points.length - 1; i++) lines.push([i, i + 1])
  return lines
}

/**
 * 템플릿 기준으로 별(책) 위치를 배치한다. 윤곽점 수보다 책이 많으면 바깥 고리로 채운다.
 * customPositions가 있으면(학생이 편집기에서 직접 옮긴 좌표) 해당 인덱스는 그 값을 우선한다.
 */
export function layoutStars(
  templateId: TemplateId | null,
  count: number,
  customPositions: (StarPosition | undefined)[] = [],
): THREE.Vector3[] {
  const basePoints = templateId ? getTemplateBasePoints(templateId) : getTemplateBasePoints('capricorn')
  const seed = templateId ? templateId.length * 97 : 42
  const rand = mulberry32(seed + 7)
  const positions: THREE.Vector3[] = []

  const outlineCount = Math.min(count, basePoints.length)
  for (let i = 0; i < outlineCount; i++) {
    const [x, y] = basePoints[i]
    const z = (rand() - 0.5) * 1.5
    positions.push(new THREE.Vector3(x, y, z))
  }

  // 윤곽보다 책이 많으면 바깥쪽으로 고리를 늘려가며 채운다.
  let remaining = count - outlineCount
  let ring = 1
  while (remaining > 0) {
    const ringRadius = 3.4 + ring * 1.1
    const ringCount = Math.min(remaining, BASE_OUTLINE_COUNT + ring * 3)
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2 + rand() * 0.4
      const x = Math.cos(angle) * ringRadius
      const y = Math.sin(angle) * ringRadius * 0.7 + (rand() - 0.5) * 1.5
      const z = (rand() - 0.5) * 2.5
      positions.push(new THREE.Vector3(x, y, z))
    }
    remaining -= ringCount
    ring++
  }

  for (let i = 0; i < positions.length; i++) {
    const custom = customPositions[i]
    if (custom) positions[i] = new THREE.Vector3(custom.x, custom.y, positions[i].z)
  }

  return positions
}

/** 학급 성운: 학생마다 다른 중심점 주변에 그 학생의 별들을 뭉쳐 배치한다. */
export function layoutClusterCenter(index: number, total: number): THREE.Vector3 {
  const rand = mulberry32(index * 733 + 11)
  const angle = (index / Math.max(total, 1)) * Math.PI * 2
  const radius = 6 + (total > 6 ? Math.floor(index / 6) * 7 : 0)
  const x = Math.cos(angle) * radius + (rand() - 0.5) * 2
  const y = Math.sin(angle) * radius + (rand() - 0.5) * 2
  const z = (rand() - 0.5) * 4
  return new THREE.Vector3(x, y, z)
}
