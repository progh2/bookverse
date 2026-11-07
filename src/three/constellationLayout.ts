import * as THREE from 'three'
import type { ZodiacSign } from '../types'

const ZODIAC_SEEDS: Record<ZodiacSign, number> = {
  aries: 1, taurus: 2, gemini: 3, cancer: 4, leo: 5, virgo: 6,
  libra: 7, scorpio: 8, sagittarius: 9, capricorn: 10, aquarius: 11, pisces: 12,
}

/** 간단한 결정적 의사난수(시드 고정 — 같은 별자리는 항상 같은 모양). */
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

/**
 * 생일 12궁(또는 기본값)을 기준으로 별(책) 위치를 배치한다.
 * 실제 천문학적 별자리 모양이 아니라, 별자리별로 고정된 절차적 윤곽을 사용한다(해커톤 범위).
 * 처음 BASE_OUTLINE_COUNT개는 윤곽을 따라, 그 이후는 바깥 고리로 채워진다.
 */
export function layoutStars(zodiac: ZodiacSign | null, count: number): THREE.Vector3[] {
  const seed = zodiac ? ZODIAC_SEEDS[zodiac] * 97 : 42
  const rand = mulberry32(seed)
  const positions: THREE.Vector3[] = []

  const outlineCount = Math.min(count, BASE_OUTLINE_COUNT)
  for (let i = 0; i < outlineCount; i++) {
    const angle = (i / BASE_OUTLINE_COUNT) * Math.PI * 2 + rand() * 0.6
    const radius = 2.2 + rand() * 1.2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * 0.7 + (rand() - 0.5) * 1.2
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
