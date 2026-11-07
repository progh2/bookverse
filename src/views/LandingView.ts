import { state } from '../state'

// 북두칠성(Big Dipper) 7개 별의 상대 좌표. 레퍼런스 시안의 좌표 체계를 그대로
// 포팅했다 (이 로고 전용이라 범용 유틸로 일반화하지 않음).
type StarKey = 'alkaid' | 'mizar' | 'alioth' | 'megrez' | 'phecda' | 'merak' | 'dubhe'

const STAR_POS: Record<StarKey, [number, number]> = {
  alkaid: [4, 8],
  mizar: [22, 14],
  alioth: [40, 23],
  megrez: [58, 32],
  phecda: [62, 55],
  merak: [92, 58],
  dubhe: [96, 33],
}

const SCALE_X = 3.35
const SCALE_Y = 3.35
const OFFSET_X = 12
const OFFSET_Y = 26

function starPoint(key: StarKey): [number, number] {
  const [x, y] = STAR_POS[key]
  return [OFFSET_X + x * SCALE_X, OFFSET_Y + y * SCALE_Y]
}

// 손잡이(alkaid~megrez) + 국자(megrez~dubhe~megrez)를 잇는 순서
const DIPPER_ORDER: StarKey[] = ['alkaid', 'mizar', 'alioth', 'megrez', 'phecda', 'merak', 'dubhe', 'megrez']

// 4개의 꼭짓점을 가진 별 모양 path (단위 좌표, scale/translate로 배치)
const STAR_PATH = 'M0,-1 L.26,-.26 L1,0 L.26,.26 L0,1 L-.26,.26 L-1,0 L-.26,-.26Z'

// 책(빛의 근원) 위치와, 거기서 천권(책이 된 별) 자리로 빛가루가 솟아오르는 경로.
const BOOK_POS: [number, number] = [196, 214]
const DUST_PATH_D = (() => {
  const [bx, by] = BOOK_POS
  const [mx, my] = starPoint('megrez')
  const cx = (bx + mx) / 2 + 18
  const cy = (by + my) / 2
  return `M${bx},${by} Q${cx},${cy} ${mx},${my}`
})()

function buildBookSvg(): string {
  const [x, y] = BOOK_POS
  // 펼쳐진 책을 단순화한 두 쪽 모양(좌/우 페이지) path. 책등은 가운데 세로선.
  const leftPage = 'M-22,-7 C-15,-11 -7,-11 0,-8 L0,10 C-7,7 -15,7 -22,11 Z'
  const rightPage = 'M22,-7 C15,-11 7,-11 0,-8 L0,10 C7,7 15,7 22,11 Z'

  const dust = Array.from({ length: 7 })
    .map((_, i) => {
      const dur = (2.6 + (i % 3) * 0.5).toFixed(2)
      const begin = (i * 0.45).toFixed(2)
      return `
        <circle r="${1.4 + (i % 3) * 0.5}" fill="var(--star-yellow)" opacity="0">
          <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${DUST_PATH_D}" rotate="auto" />
          <animate attributeName="opacity" values="0;0.9;0" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" />
        </circle>
      `
    })
    .join('')

  return `
    <circle class="bigdipper-halo" cx="${x}" cy="${y}" r="20" fill="var(--star-yellow)"></circle>
    <g transform="translate(${x} ${y})">
      <g class="bigdipper-book">
        <path d="${leftPage}" fill="var(--bg-soft)" stroke="var(--star-yellow)" stroke-width="1.4"></path>
        <path d="${rightPage}" fill="var(--bg-soft)" stroke="var(--star-yellow)" stroke-width="1.4"></path>
        <line x1="0" y1="-8" x2="0" y2="10" stroke="var(--star-yellow)" stroke-width="1.2"></line>
      </g>
    </g>
    <g class="bigdipper-dust">${dust}</g>
  `
}

function buildConstellationSvg(): string {
  const linePoints = DIPPER_ORDER.map((key) => starPoint(key).join(',')).join(' ')

  const starsSvg = (Object.keys(STAR_POS) as StarKey[])
    .map((key, i) => {
      const [x, y] = starPoint(key)
      const size = 6 + (i % 3) // 6~8 사이로 살짝 다르게
      const delay = (i * 0.4).toFixed(2)
      const duration = (3 + (i % 4) * 0.4).toFixed(2)
      const isBookStar = key === 'megrez' // 천권(天權) 자리 - "책이 된 별"
      const halo = isBookStar
        ? `<circle class="bigdipper-halo" cx="${x}" cy="${y}" r="13" fill="var(--star-yellow)"></circle>`
        : ''
      return `${halo}<path class="bigdipper-star" d="${STAR_PATH}" fill="${isBookStar ? 'var(--star-yellow)' : '#fff'}" transform="translate(${x} ${y}) scale(${size})" style="animation-duration:${duration}s;animation-delay:${delay}s"></path>`
    })
    .join('')

  return `
    <svg class="bigdipper-svg" viewBox="0 0 360 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true"
         role="img" aria-label="밤하늘에 펼쳐진 책에서 빛이 올라가 북두칠성으로 이어진다">
      ${buildBookSvg()}
      <polyline class="bigdipper-line" points="${linePoints}" pathLength="1"></polyline>
      ${starsSvg}
    </svg>
  `
}

// 화면 전체에 흩뿌려지는 잔별. 결정적일 필요가 없어 매 렌더마다 무작위로 생성한다.
function buildBgStars(count: number): string {
  let out = ''
  for (let i = 0; i < count; i++) {
    const left = (Math.random() * 100).toFixed(2)
    const top = (Math.random() * 100).toFixed(2)
    const size = (1 + Math.random() * 1.6).toFixed(2)
    const opacity = (0.15 + Math.random() * 0.5).toFixed(2)
    const duration = (3 + Math.random() * 4).toFixed(2)
    const delay = (Math.random() * 5).toFixed(2)
    out += `<i style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;--o:${opacity};animation-duration:${duration}s;animation-delay:${delay}s"></i>`
  }
  return out
}

export function renderLanding(container: HTMLElement) {
  const studentHref = state.account ? '#/classes' : '#/auth'
  container.innerHTML = `
    <div class="view">
      <div class="bigdipper-page">
        <div class="bigdipper-bg" aria-hidden="true">${buildBgStars(70)}</div>
        <div class="bigdipper-wrap">
          <div class="bigdipper-section">
            ${buildConstellationSvg()}
            <h1 class="bigdipper-title">⭐ Book두칠성</h1>
            <p class="bigdipper-tagline">읽은 책이 별이 되어, 나만의 별자리가 됩니다</p>
          </div>
          <div class="landing-grid">
            <a class="choice-card" href="${studentHref}">
              <h2>⭐ 학생으로 입장</h2>
              <p>닉네임과 숫자 4자리 비밀번호로 로그인하거나 새로 가입해서 내 별자리를 키워요.</p>
            </a>
            <a class="choice-card" href="#/teacher">
              <h2>🏫 교사로 입장</h2>
              <p>구글 계정으로 로그인해 학급 코드를 만들고 관리해요.</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  `
}
