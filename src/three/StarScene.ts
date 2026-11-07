import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getGlowTexture } from './starTexture'
import { GENRE_COLORS, type Book, computeBrightness } from '../types'

export interface StarEntry {
  book: Book
  position: THREE.Vector3
}

export interface StarLabel {
  text: string
  position: THREE.Vector3
}

export interface StarSceneOptions {
  backgroundColor?: number
  onStarClick?: (book: Book) => void
  cameraPosition?: [number, number, number] // 정면 고정 뷰의 기준 위치(토글로 되돌아올 때도 이 위치)
  autoRotateSpeed?: number // 화면 평면(z축) 기준 자동 회전 속도(rad/s). 학급 성운의 원형 배치를 천천히 돌릴 때 사용
  centerGlow?: boolean // 원형 배치 한가운데 은하 중심처럼 은은한 빛을 둘지
}

/** 개인 별자리 뷰와 학급 성운 뷰가 공유하는 Three.js 렌더링 엔진. */
export class StarScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  // 별·선·이름표는 모두 root에 붙여서 autoRotate 시 한꺼번에 돈다(클릭 판정은 월드 좌표 기준이라 영향 없음)
  private readonly root = new THREE.Group()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private sprites: THREE.Sprite[] = []
  private lines: THREE.Line[] = []
  private dashedLines: THREE.Line[] = []
  private labels: THREE.Sprite[] = []
  private clock = new THREE.Clock()
  private disposed = false
  private container: HTMLElement
  private resizeObserver: ResizeObserver
  private initialCameraPosition: THREE.Vector3

  constructor(container: HTMLElement, private opts: StarSceneOptions = {}) {
    this.container = container
    this.scene.background = new THREE.Color(opts.backgroundColor ?? 0x0f1b3d)
    this.scene.add(this.root)

    const { clientWidth: w, clientHeight: h } = container
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500)
    this.camera.position.set(...(opts.cameraPosition ?? [0, 2, 16]))
    this.initialCameraPosition = this.camera.position.clone()

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.minDistance = 4
    this.controls.maxDistance = Math.max(80, this.camera.position.length() * 1.6)
    // 기본값: 정면 고정 뷰(회전/패닝 비활성화). 사용자가 토글 버튼을 눌러야 자유 회전(3D) 모드가 된다.
    this.controls.enableRotate = false
    this.controls.enablePan = false

    this.scene.add(new THREE.AmbientLight(0x8fb4ff, 0.6))

    if (opts.centerGlow) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: 0xffe9b0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.35,
      }))
      glow.scale.set(9, 9, 1)
      this.scene.add(glow) // 중심 빛은 회전시킬 필요가 없어 root가 아닌 scene에 둔다
    }

    this.renderer.domElement.addEventListener('click', this.handleClick)
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)

    this.animate()
  }

  setStars(entries: StarEntry[]) {
    for (const sprite of this.sprites) this.root.remove(sprite)
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
      this.root.add(sprite)
      this.sprites.push(sprite)
    }
  }

  /** 별자리를 이루는 실선(학생이 이은 선 또는 템플릿 기본 선). */
  setConnections(pairs: [THREE.Vector3, THREE.Vector3][]) {
    for (const line of this.lines) this.root.remove(line)
    this.lines = []
    const material = new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.8 })
    for (const [a, b] of pairs) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material)
      this.root.add(line)
      this.lines.push(line)
    }
  }

  /** 서로 다른 별자리를 느슨하게 잇는 연한 점선(예: 같은 문장에 밑줄 친 친구). */
  setDashedConnections(pairs: [THREE.Vector3, THREE.Vector3][]) {
    for (const line of this.dashedLines) this.root.remove(line)
    this.dashedLines = []
    const material = new THREE.LineDashedMaterial({
      color: 0xffd66b, transparent: true, opacity: 0.35, dashSize: 0.35, gapSize: 0.45,
    })
    for (const [a, b] of pairs) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material)
      line.computeLineDistances() // 점선은 선 길이 정보가 있어야 그려진다
      this.root.add(line)
      this.dashedLines.push(line)
    }
  }

  /** 별자리 이름표(학생 닉네임 등). 스프라이트라 항상 똑바로 카메라를 향한다. */
  setLabels(labels: StarLabel[]) {
    for (const label of this.labels) {
      this.root.remove(label)
      label.material.map?.dispose()
      label.material.dispose()
    }
    this.labels = []
    for (const { text, position } of labels) {
      const sprite = makeTextSprite(text)
      sprite.position.copy(position)
      this.root.add(sprite)
      this.labels.push(sprite)
    }
  }

  /** 회전/패닝을 잠그면 정면 고정 뷰로, 풀면 자유 회전(3D) 모드로 전환한다. */
  setRotationLocked(locked: boolean) {
    this.controls.enableRotate = !locked
    this.controls.enablePan = !locked
    if (locked) {
      // 고정 뷰로 돌아갈 때는 생성 시점의 정면 각도로 카메라를 리셋
      this.camera.position.copy(this.initialCameraPosition)
      this.controls.target.set(0, 0, 0)
      this.controls.update()
    }
  }

  isRotationLocked(): boolean {
    return !this.controls.enableRotate
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
    const dt = this.clock.getDelta()
    const t = this.clock.elapsedTime
    if (this.opts.autoRotateSpeed && !reducedMotion()) {
      this.root.rotation.z += this.opts.autoRotateSpeed * dt
    }
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

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.font = "bold 52px 'Pretendard', system-ui, sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(15, 27, 61, 0.9)'
  ctx.shadowBlur = 12
  ctx.fillStyle = 'rgba(244, 246, 255, 0.92)'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false,
  }))
  sprite.scale.set(4, 1, 1)
  return sprite
}
