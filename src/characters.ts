/**
 * 프로필 캐릭터(우주복을 입고 책을 든 아기 우주인). 이미지 파일 없이 SVG로 그려서
 * 어디서든 가볍게 쓰고, 종류(얼굴·귀·색)만 바꿔 여러 캐릭터를 만든다.
 */
export type CharacterId = 'alien' | 'cat' | 'bunny' | 'bear' | 'robot' | 'fox'

interface CharacterSpec {
  id: CharacterId
  name: string
  face: string // 얼굴색
  accent: string // 귀 안쪽·볼 등 포인트색
  glow: string // 뒤쪽 은은한 빛
}

export const CHARACTERS: CharacterSpec[] = [
  { id: 'alien', name: '초록 외계인', face: '#9fd8a8', accent: '#f6a6a6', glow: '#9b7bff' },
  { id: 'cat', name: '별고양이', face: '#f5c28c', accent: '#f29a9a', glow: '#ff9fc2' },
  { id: 'bunny', name: '달토끼', face: '#f7f1ea', accent: '#f6b3c4', glow: '#8fb4ff' },
  { id: 'bear', name: '곰돌 탐험가', face: '#c99a6e', accent: '#e9b48c', glow: '#ffd66b' },
  { id: 'robot', name: '책읽는 로봇', face: '#b9c4dd', accent: '#6bffd6', glow: '#6bffd6' },
  { id: 'fox', name: '꼬마 여우', face: '#f39a5b', accent: '#fff3e6', glow: '#ff9a6b' },
]

export const DEFAULT_CHARACTER: CharacterId = 'alien'

export function characterSpec(id: string | undefined): CharacterSpec {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]
}

let uid = 0

/** 캐릭터 SVG 문자열. size는 가로 픽셀(세로는 1.1배). */
export function characterSvg(id: string | undefined, size = 180): string {
  const c = characterSpec(id)
  const k = `ch${++uid}` // 같은 화면에 여러 개 그려도 gradient id가 겹치지 않게
  const eyes = c.id === 'robot'
    ? `<rect x="78" y="92" width="44" height="16" rx="8" fill="#13224f"/>
       <circle cx="90" cy="100" r="5" fill="${c.accent}"/><circle cx="110" cy="100" r="5" fill="${c.accent}"/>`
    : `<ellipse cx="86" cy="100" rx="8" ry="10" fill="#1b1f3b"/><ellipse cx="114" cy="100" rx="8" ry="10" fill="#1b1f3b"/>
       <circle cx="89" cy="96" r="3" fill="#fff"/><circle cx="117" cy="96" r="3" fill="#fff"/>
       <ellipse cx="74" cy="114" rx="7" ry="4.5" fill="${c.accent}" opacity="0.8"/>
       <ellipse cx="126" cy="114" rx="7" ry="4.5" fill="${c.accent}" opacity="0.8"/>`
  const mouth = c.id === 'robot'
    ? `<rect x="92" y="116" width="16" height="4" rx="2" fill="#13224f"/>`
    : `<path d="M92 114 Q100 124 108 114" fill="#c2455a" stroke="#1b1f3b" stroke-width="2" stroke-linejoin="round"/>`

  const ears: Record<CharacterId, string> = {
    alien: `<line x1="82" y1="68" x2="74" y2="50" stroke="${c.face}" stroke-width="5" stroke-linecap="round"/>
            <line x1="118" y1="68" x2="126" y2="50" stroke="${c.face}" stroke-width="5" stroke-linecap="round"/>
            <circle cx="73" cy="48" r="7" fill="${c.face}"/><circle cx="127" cy="48" r="7" fill="${c.face}"/>`,
    cat: `<path d="M66 82 L72 52 L92 70 Z" fill="${c.face}"/><path d="M134 82 L128 52 L108 70 Z" fill="${c.face}"/>
          <path d="M72 76 L75 60 L86 70 Z" fill="${c.accent}"/><path d="M128 76 L125 60 L114 70 Z" fill="${c.accent}"/>`,
    bunny: `<ellipse cx="82" cy="50" rx="9" ry="26" fill="${c.face}"/><ellipse cx="118" cy="50" rx="9" ry="26" fill="${c.face}"/>
            <ellipse cx="82" cy="52" rx="4.5" ry="18" fill="${c.accent}"/><ellipse cx="118" cy="52" rx="4.5" ry="18" fill="${c.accent}"/>`,
    bear: `<circle cx="70" cy="72" r="13" fill="${c.face}"/><circle cx="130" cy="72" r="13" fill="${c.face}"/>
           <circle cx="70" cy="72" r="6" fill="${c.accent}"/><circle cx="130" cy="72" r="6" fill="${c.accent}"/>`,
    robot: `<line x1="100" y1="62" x2="100" y2="48" stroke="#8a95b5" stroke-width="4"/>
            <circle cx="100" cy="45" r="6" fill="${c.accent}"/>`,
    fox: `<path d="M64 84 L70 50 L92 72 Z" fill="${c.face}"/><path d="M136 84 L130 50 L108 72 Z" fill="${c.face}"/>
          <path d="M70 76 L73 60 L84 71 Z" fill="#2b2b3a"/><path d="M130 76 L127 60 L116 71 Z" fill="#2b2b3a"/>`,
  }

  const head = c.id === 'robot'
    ? `<rect x="64" y="66" width="72" height="66" rx="18" fill="${c.face}"/>`
    : c.id === 'fox'
      ? `<circle cx="100" cy="100" r="38" fill="${c.face}"/><path d="M76 110 Q100 140 124 110 Q112 124 100 124 Q88 124 76 110Z" fill="${c.accent}"/>`
      : `<circle cx="100" cy="100" r="38" fill="${c.face}"/>`

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="${size}" height="${Math.round(size * 1.1)}" class="character-svg" aria-hidden="true">
    <defs>
      <radialGradient id="${k}-glow"><stop offset="0" stop-color="${c.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${k}-helmet" cx="35%" cy="30%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.06"/></radialGradient>
    </defs>
    <circle cx="100" cy="118" r="96" fill="url(#${k}-glow)"/>
    <!-- 별 안테나 -->
    <line x1="100" y1="40" x2="100" y2="26" stroke="#7f8fc4" stroke-width="3"/>
    <path class="character-star" d="M100 6 L105 19 L119 19 L108 27 L112 40 L100 32 L88 40 L92 27 L81 19 L95 19 Z" fill="#ffd66b" stroke="#e6b94a" stroke-width="1.5"/>
    <!-- 배낭·몸통 -->
    <rect x="46" y="150" width="34" height="46" rx="10" fill="#26346e"/>
    <ellipse cx="100" cy="182" rx="46" ry="34" fill="#efe8d8"/>
    <ellipse cx="100" cy="192" rx="30" ry="14" fill="#e2d9c4"/>
    ${ears[c.id]}
    ${head}
    ${eyes}
    ${mouth}
    <!-- 헬멧 -->
    <circle cx="100" cy="100" r="58" fill="url(#${k}-helmet)" stroke="#dfe6ff" stroke-opacity="0.55" stroke-width="2.5"/>
    <path d="M62 82 Q70 58 94 50" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="4" stroke-linecap="round"/>
    <!-- 펼친 책 -->
    <path d="M100 176 L60 168 L62 202 L100 208 Z" fill="#2c3d85" stroke="#1b2659" stroke-width="2"/>
    <path d="M100 176 L140 168 L138 202 L100 208 Z" fill="#33479a" stroke="#1b2659" stroke-width="2"/>
    <path d="M118 182 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="#ffd66b"/>
    <path d="M78 186 l1.5 3.5 3.5 0 -3 2 1.5 3.5 -3.5 -2 -3.5 2 1.5 -3.5 -3 -2 3.5 0z" fill="#ffd66b" opacity="0.8"/>
    <circle cx="62" cy="184" r="8" fill="${c.id === 'robot' ? '#8a95b5' : c.face}"/>
    <circle cx="138" cy="184" r="8" fill="${c.id === 'robot' ? '#8a95b5' : c.face}"/>
  </svg>`
}

/** 별(책) 수에 따라 붙는 칭호. */
export function readerTitle(starCount: number): string {
  if (starCount >= 15) return '은하를 잇는 독서가'
  if (starCount >= 10) return '별자리 수집가'
  if (starCount >= 6) return '반짝이는 별지기'
  if (starCount >= 3) return '호기심 많은 탐험가'
  if (starCount >= 1) return '첫 별을 띄운 여행자'
  return '새내기 별지기'
}
