import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getGlowTexture, getRingTexture, getShapeTexture } from './starTexture'
import { GENRE_COLORS, type Book, computeBrightness } from '../types'
import { DEFAULT_LINE_COLOR, type ResolvedStarStyle } from '../shop'

export interface StarEntry {
  book: Book
  position: THREE.Vector3
  style?: ResolvedStarStyle // 별가루 상점 꾸미기(모양·윤곽)
}

type StarAnim = { kind: 'born' | 'brighten'; start: number | null }

const ANIM_DURATION = { born: 1.6, brighten: 1.8 } as const

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
  private nebulae: THREE.Sprite[] = []
  private avatars: THREE.Sprite[] = []
  private dust: THREE.Points | null = null
  private bursts: { sprite: THREE.Sprite; start: number; dur: number; to: number }[] = []
  // 이전에 그린 별들의 밝기(책 id → 밝기). 다시 그릴 때 새 별·밝아진 별을 알아내 연출한다. 첫 그리기 전엔 null
  private knownStars: Map<string, number> | null = null
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

    const known = this.knownStars
    const nextKnown = new Map<string, number>()
    for (const entry of entries) {
      const brightness = computeBrightness(entry.book)
      nextKnown.set(entry.book.id, brightness)
      const colorHex = GENRE_COLORS[entry.book.genre ?? '기타'] ?? GENRE_COLORS['기타']
      const material = new THREE.SpriteMaterial({
        map: getShapeTexture(entry.style?.shape),
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
      sprite.userData.baseScale = scale

      const outline = entry.style?.outline
      if (outline != null) {
        // 윤곽 고리는 별의 자식으로 붙여 별 크기·연출을 그대로 따라가게 한다
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({
          map: getRingTexture(),
          color: outline === 'rainbow' ? 0xffffff : outline,
          transparent: true,
          depthWrite: false,
          opacity: 0.85,
        }))
        ring.scale.set(0.95, 0.95, 1)
        ring.userData.rainbow = outline === 'rainbow'
        sprite.add(ring)
      }

      // 새로 생긴 별·밝아진 별은 (팝업이 닫혀 화면이 보일 때) 반짝 연출을 한다
      if (known && !reducedMotion()) {
        const prev = known.get(entry.book.id)
        if (prev === undefined) sprite.userData.anim = { kind: 'born', start: null } satisfies StarAnim
        else if (brightness > prev) sprite.userData.anim = { kind: 'brighten', start: null } satisfies StarAnim
      }
      this.root.add(sprite)
      this.sprites.push(sprite)
    }
    this.knownStars = nextKnown
  }

  /** 별이 생기거나 밝아질 때 퍼져 나가는 빛 고리. */
  private spawnBurst(at: THREE.Sprite, t: number, big: boolean) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRingTexture(),
      color: at.material.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    }))
    sprite.position.copy(at.position)
    sprite.scale.set(0.1, 0.1, 1)
    this.root.add(sprite)
    this.bursts.push({ sprite, start: t, dur: 1.4, to: big ? 5 : 3.2 })
  }

  /** 별자리를 이루는 실선(학생이 이은 선 또는 템플릿 기본 선). */
  setConnections(pairs: ([THREE.Vector3, THREE.Vector3] | [THREE.Vector3, THREE.Vector3, number])[]) {
    for (const line of this.lines) this.root.remove(line)
    this.lines = []
    // 상점에서 선 색을 바꾼 학생도 있어 색마다 재질을 하나씩 만든다(세 번째 값이 없으면 기본 파랑)
    const materials = new Map<number, THREE.LineBasicMaterial>()
    for (const [a, b, color = DEFAULT_LINE_COLOR] of pairs) {
      let material = materials.get(color)
      if (!material) {
        material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
        materials.set(color, material)
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material)
      this.root.add(line)
      this.lines.push(line)
    }
  }

  /**
   * 서로 다른 별자리를 느슨하게 잇는 연한 점선(예: 같은 문장에 밑줄 친 친구).
   * 원형 배치에서 직선으로 그으면 화면을 가로지르는 줄이 어지럽게 겹쳐서,
   * 은하 중심 쪽으로 살짝 휘는 곡선으로 그린다.
   */
  setDashedConnections(pairs: [THREE.Vector3, THREE.Vector3][]) {
    for (const line of this.dashedLines) this.root.remove(line)
    this.dashedLines = []
    const material = new THREE.LineDashedMaterial({
      color: 0xffd66b, transparent: true, opacity: 0.22, dashSize: 0.4, gapSize: 0.6,
    })
    for (const [a, b] of pairs) {
      const control = a.clone().add(b).multiplyScalar(0.5 * 0.45)
      const points = new THREE.QuadraticBezierCurve3(a, control, b).getPoints(32)
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material)
      line.computeLineDistances() // 점선은 선 길이 정보가 있어야 그려진다
      this.root.add(line)
      this.dashedLines.push(line)
    }
  }

  /** 별자리 이름표(학생 닉네임 등). 스프라이트라 항상 똑바로 카메라를 향한다. */
  setLabels(labels: StarLabel[], scale = 1) {
    for (const label of this.labels) {
      this.root.remove(label)
      label.material.map?.dispose()
      label.material.dispose()
    }
    this.labels = []
    for (const { text, position } of labels) {
      const sprite = makeTextSprite(text)
      sprite.scale.multiplyScalar(scale)
      sprite.position.copy(position)
      this.root.add(sprite)
      this.labels.push(sprite)
    }
  }

  /** 별자리마다 뒤에 깔리는 은은한 색 성운(학급 성운의 "성운 덩어리" 느낌). */
  setNebulae(nebulae: { position: THREE.Vector3; color: number; size: number }[]) {
    for (const n of this.nebulae) this.root.remove(n)
    this.nebulae = []
    for (const { position, color, size } of nebulae) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(), color, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: 0.22,
      }))
      sprite.scale.set(size, size, 1)
      sprite.position.copy(position)
      sprite.renderOrder = -1
      this.root.add(sprite)
      this.nebulae.push(sprite)
    }
  }

  /** SVG 그림(캐릭터 등)을 별자리 옆에 띄운다. 이미지가 로드되면 그때 보인다. */
  setAvatars(avatars: { svg: string; position: THREE.Vector3; size: number }[]) {
    for (const a of this.avatars) {
      this.root.remove(a)
      a.material.map?.dispose()
      a.material.dispose()
    }
    this.avatars = []
    for (const { svg, position, size } of avatars) {
      const img = new Image()
      const texture = new THREE.Texture(img)
      texture.colorSpace = THREE.SRGBColorSpace
      img.onload = () => { texture.needsUpdate = true }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
      sprite.scale.set(size, size * 1.1, 1)
      sprite.position.copy(position)
      this.root.add(sprite)
      this.avatars.push(sprite)
    }
  }

  /** 은하 팔처럼 흩뿌린 작은 빛 알갱이(클릭 대상 아님). 색은 점마다 따로 줄 수 있다. */
  setDust(points: { position: THREE.Vector3; color: number }[], size = 0.12) {
    if (this.dust) {
      this.root.remove(this.dust)
      this.dust.geometry.dispose()
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => p.position))
    const colors = new Float32Array(points.length * 3)
    const c = new THREE.Color()
    points.forEach((p, i) => c.setHex(p.color).toArray(colors, i * 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({
      size, map: getGlowTexture(), vertexColors: true, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.root.add(this.dust)
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
    const hits = this.raycaster.intersectObjects(this.sprites, false) // 윤곽 고리(자식)는 클릭 대상이 아니다
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
    // 팝업(책 상세 등)이 떠 있으면 연출을 미뤘다가 화면이 보일 때 시작한다
    const screenVisible = !document.querySelector('.modal-backdrop')
    for (const sprite of this.sprites) {
      const twinkle = 0.9 + Math.sin(t * 2 + sprite.position.x) * 0.08
      const baseOpacity = (sprite.userData.baseOpacity as number) ?? sprite.material.opacity
      let opacity = baseOpacity * twinkle
      const anim = sprite.userData.anim as StarAnim | undefined
      if (anim) {
        const base = sprite.userData.baseScale as number
        if (anim.start === null) {
          if (screenVisible) {
            anim.start = t
            this.spawnBurst(sprite, t, anim.kind === 'born')
          }
          if (anim.kind === 'born') sprite.scale.set(0.001, 0.001, 1) // 시작 전엔 아직 없는 별
        }
        if (anim.start !== null) {
          const p = Math.min(1, (t - anim.start) / ANIM_DURATION[anim.kind])
          const k = anim.kind === 'born'
            ? easeOutBack(p) * (1 + 0.5 * Math.sin(Math.PI * p)) // 톡 튀어나오며 잠깐 크게 빛남
            : 1 + 0.7 * Math.sin(Math.PI * p) * (1 - p * 0.3) // 한 번 크게 숨 쉬듯 밝아짐
          sprite.scale.set(base * k, base * k, 1)
          opacity += 0.5 * Math.sin(Math.PI * p)
          if (p >= 1) {
            sprite.scale.set(base, base, 1)
            delete sprite.userData.anim
          }
        }
      }
      sprite.material.opacity = Math.min(1, opacity)
      for (const child of sprite.children) {
        if (child.userData.rainbow) ((child as THREE.Sprite).material.color).setHSL((t * 0.08 + sprite.position.x * 0.05) % 1, 0.8, 0.7)
      }
    }
    this.bursts = this.bursts.filter((b) => {
      const p = (t - b.start) / b.dur
      if (p >= 1) {
        this.root.remove(b.sprite)
        b.sprite.material.dispose()
        return false
      }
      const s = 0.3 + (b.to - 0.3) * (1 - (1 - p) ** 3)
      b.sprite.scale.set(s, s, 1)
      b.sprite.material.opacity = 0.9 * (1 - p)
      return true
    })
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

function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
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
