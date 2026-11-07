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
