import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getGlowTexture } from './starTexture'
import { GENRE_COLORS, type Book, computeBrightness } from '../types'

export interface StarEntry {
  book: Book
  position: THREE.Vector3
}

export interface StarSceneOptions {
  backgroundColor?: number
  onStarClick?: (book: Book) => void
}

/** 개인 별자리 뷰와 학급 성운 뷰가 공유하는 Three.js 렌더링 엔진. */
export class StarScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private sprites: THREE.Sprite[] = []
  private lines: THREE.Line[] = []
  private clock = new THREE.Clock()
  private disposed = false
  private container: HTMLElement
  private resizeObserver: ResizeObserver

  constructor(container: HTMLElement, private opts: StarSceneOptions = {}) {
    this.container = container
    this.scene.background = new THREE.Color(opts.backgroundColor ?? 0x0f1b3d)

    const { clientWidth: w, clientHeight: h } = container
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500)
    this.camera.position.set(0, 2, 16)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.minDistance = 4
    this.controls.maxDistance = 80

    this.scene.add(new THREE.AmbientLight(0x8fb4ff, 0.6))

    this.renderer.domElement.addEventListener('click', this.handleClick)
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)

    this.animate()
  }

  setStars(entries: StarEntry[]) {
    for (const sprite of this.sprites) this.scene.remove(sprite)
    this.sprites = []

    const texture = getGlowTexture()
    for (const entry of entries) {
      const brightness = computeBrightness(entry.book)
      const colorHex = GENRE_COLORS[entry.book.genre ?? '기타'] ?? GENRE_COLORS['기타']
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: colorHex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.55 + brightness * 0.09,
      })
      const sprite = new THREE.Sprite(material)
      const scale = entry.book.isBigStar ? 1.9 : 0.55 + brightness * 0.22
      sprite.scale.set(scale, scale, 1)
      sprite.position.copy(entry.position)
      sprite.userData.book = entry.book
      sprite.userData.baseOpacity = material.opacity // 매 프레임 반짝임 계산의 기준값(고정)
      this.scene.add(sprite)
      this.sprites.push(sprite)
    }
  }

  setConnections(pairs: [THREE.Vector3, THREE.Vector3][]) {
    for (const line of this.lines) this.scene.remove(line)
    this.lines = []
    const material = new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.5 })
    for (const [a, b] of pairs) {
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b])
      const line = new THREE.Line(geometry, material)
      this.scene.add(line)
      this.lines.push(line)
    }
  }

  private handleClick = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.sprites)
    if (hits.length > 0) {
      const book = hits[0].object.userData.book as Book
      this.opts.onStarClick?.(book)
    }
  }

  private handleResize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private animate = () => {
    if (this.disposed) return
    requestAnimationFrame(this.animate)
    const t = this.clock.getElapsedTime()
    for (const sprite of this.sprites) {
      const twinkle = 0.9 + Math.sin(t * 2 + sprite.position.x) * 0.08
      const baseOpacity = (sprite.userData.baseOpacity as number) ?? sprite.material.opacity
      sprite.material.opacity = Math.min(1, baseOpacity * twinkle)
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('click', this.handleClick)
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }
}
