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
    <svg class="bigdipper-svg" viewBox="0 0 360 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
            <h1 class="bigdipper-title">⭐ 북두칠성</h1>
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
