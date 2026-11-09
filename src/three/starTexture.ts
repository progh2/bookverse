import * as THREE from 'three'

let cached: THREE.Texture | null = null

/** 부드러운 원형 글로우 텍스처를 캔버스로 생성한다(포스트프로세싱 없이 '빛나는 별' 느낌을 내기 위해). */
export function getGlowTexture(): THREE.Texture {
  if (cached) return cached
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.25)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  cached = new THREE.CanvasTexture(canvas)
  return cached
}

const shapeCache = new Map<string, THREE.Texture>()

/**
 * 별가루 상점의 별 모양 텍스처(흰색으로 그려 SpriteMaterial.color로 장르 색을 입힌다).
 * 알 수 없는 모양이면 기본 동그란 글로우.
 */
export function getShapeTexture(shape: string | undefined): THREE.Texture {
  if (!shape || shape === 'round') return getGlowTexture()
  const hit = shapeCache.get(shape)
  if (hit) return hit
  const size = 128
  const c = size / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // 모양 뒤에 옅은 빛 번짐을 깔아 기본 별처럼 은은하게 보이게 한다
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c)
  halo.addColorStop(0, 'rgba(255,255,255,0.55)')
  halo.addColorStop(0.45, 'rgba(255,255,255,0.12)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 10
  ctx.beginPath()
  if (shape === 'sparkle') {
    // 네 갈래로 뻗는 반짝이
    const long = c * 0.92
    const thin = c * 0.12
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      const b = a + Math.PI / 4
      ctx.lineTo(c + Math.cos(a) * long, c + Math.sin(a) * long)
      ctx.lineTo(c + Math.cos(b) * thin, c + Math.sin(b) * thin)
    }
  } else if (shape === 'heart') {
    const s = c * 0.42
    ctx.moveTo(c, c + s * 1.35)
    ctx.bezierCurveTo(c - s * 2.1, c + s * 0.1, c - s * 1.1, c - s * 1.6, c, c - s * 0.55)
    ctx.bezierCurveTo(c + s * 1.1, c - s * 1.6, c + s * 2.1, c + s * 0.1, c, c + s * 1.35)
  } else if (shape === 'star5') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? c * 0.62 : c * 0.26
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
  } else {
    // diamond
    ctx.moveTo(c, c - c * 0.6)
    ctx.lineTo(c + c * 0.36, c)
    ctx.lineTo(c, c + c * 0.6)
    ctx.lineTo(c - c * 0.36, c)
  }
  ctx.closePath()
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  shapeCache.set(shape, texture)
  return texture
}

let ringCached: THREE.Texture | null = null

/** 별 둘레의 윤곽(링) 텍스처. 색은 SpriteMaterial.color로 입힌다. */
export function getRingTexture(): THREE.Texture {
  if (ringCached) return ringCached
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 8
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2)
  ctx.stroke()
  ringCached = new THREE.CanvasTexture(canvas)
  return ringCached
}
