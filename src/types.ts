export interface ClassRoom {
  code: string
  name: string
  teacherUid: string
  nebulaVisible: boolean
  rankingVisible: boolean
  openaiKeyConfigured?: boolean
  openaiKeyUpdatedAt?: number
  createdAt: number
}

export interface Student {
  id: string
  classCode: string
  nickname: string
  pinHash: string
  zodiac: ZodiacSign | null
  starDust: number
  dailyEarned: number
  lastEarnDate: string // YYYY-MM-DD (KST)
  createdAt: number
}

export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces'

export const GENRE_COLORS: Record<string, number> = {
  '소설': 0xff6b8a,
  '시': 0xffd66b,
  '에세이': 0x8fb4ff,
  '인문': 0xb98fff,
  '과학': 0x6bffd6,
  '역사': 0xff9a6b,
  '기타': 0xcccccc,
}

export interface Book {
  id: string
  studentId: string
  classCode: string
  title: string
  author: string
  rating: number // 1~5, required
  quote?: string
  quotePage?: string
  reason?: string
  rereadCount?: number
  summary?: string
  feeling?: string
  inquiryQuestion?: string
  hasPhoto?: boolean
  isBigStar?: boolean
  bigStarReason?: string
  genre?: string // AI 추정 또는 학생이 고친 값
  genreIsAiGuess?: boolean
  keywords?: string[]
  createdAt: number
}

const OPTIONAL_ACTIVITY_KEYS: (keyof Book)[] = [
  'quote', 'reason', 'rereadCount', 'summary', 'feeling', 'inquiryQuestion', 'hasPhoto',
]

/** 책에 남긴 선택 활동 종류 수를 세어 별 밝기(1~5단계)를 계산한다. */
export function computeBrightness(book: Book): 1 | 2 | 3 | 4 | 5 {
  const filled = OPTIONAL_ACTIVITY_KEYS.filter((k) => {
    const v = book[k]
    if (v === undefined || v === null || v === false) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'number') return v > 0
    return true
  }).length
  if (filled >= 5) return 5
  if (filled >= 3) return 4
  if (filled >= 2) return 3
  if (filled >= 1) return 2
  return 1
}

export const STAR_DUST_RULES = {
  registerBook: 7, // 제목+저자+별점
  quote: 3,
  reason: 4,
  reread: 5,
  summary: 6,
  feeling: 6,
  inquiryQuestion: 6,
  photo: 8,
  cheerMessage: 3,
  heart: 1,
  dailyCap: 30,
} as const
