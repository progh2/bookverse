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

/** 전역 학생 계정. 닉네임+PIN은 앱 전체에서 유일하며(학급마다 따로가 아님), 여러 학급에 동시에 속할 수 있다. */
export interface StudentAccount {
  id: string
  nickname: string
  pinHash: string
  classCodes: string[]
  createdAt: number
}

export interface StarPosition {
  x: number
  y: number
}

export interface StarLine {
  a: string // bookId
  b: string // bookId
}

/** 한 학급 안에서의 학생 참여 정보(별자리·별가루 등은 학급별로 따로 쌓인다). 문서 ID는 StudentAccount.id와 같다. */
export interface Student {
  id: string
  classCode: string
  nickname: string // StudentAccount.nickname의 복사본(목록 표시용)
  constellationTemplate: TemplateId
  starPositions?: Record<string, StarPosition> // bookId -> 직접 배치한 좌표(편집기에서 저장)
  starLines?: StarLine[] // 편집기에서 직접 이은 선(Firestore는 중첩 배열을 못 담아 객체 배열로 저장)
  character?: string // 프로필 캐릭터 id(src/characters.ts), 없으면 기본 캐릭터
  starDust: number
  dailyEarned: number
  lastEarnDate: string // YYYY-MM-DD (KST)
  createdAt: number
}

export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces'

export type FamousConstellationId = 'big_dipper' | 'orion' | 'cassiopeia' | 'cygnus'

export type TemplateId = ZodiacSign | FamousConstellationId

export const GENRE_COLORS: Record<string, number> = {
  '소설': 0xff6b8a,
  '시': 0xffd66b,
  '에세이': 0x8fb4ff,
  '인문': 0xb98fff,
  '과학': 0x6bffd6,
  '역사': 0xff9a6b,
  '기타': 0xcccccc,
}

/**
 * 책 문서에는 필수 정보(제목·저자·별점·장르)만 두고, 문장·계기·요약 같은 기록은
 * books/{id}/entries 하위 컬렉션에 여러 개씩(본인·친구 모두) 쌓는다.
 * 목록 화면이 하위 컬렉션을 매번 읽지 않도록 개수·문장 키를 책 문서에 함께 적어둔다.
 */
export interface Book {
  id: string
  studentId: string
  classCode: string
  title: string
  author: string
  rating: number // 1~5, required
  isBigStar?: boolean
  bigStarReason?: string
  genre?: string // AI 추정 또는 학생이 고른 값
  genreIsAiGuess?: boolean
  keywords?: string[]
  entryCounts?: Partial<Record<EntryType, number>> // 기록 종류별 개수(별 밝기·목록 표시용)
  quoteKeys?: string[] // 정규화한 문장들(학급 성운의 "같은 문장 친구" 연결용)
  earnedTypes?: string[] // 주인이 이미 별가루를 받은 기록 종류(중복 적립 방지)
  createdAt: number
}

export type EntryType = 'quote' | 'reason' | 'reread' | 'summary' | 'feeling' | 'inquiry' | 'opinion'

/** 책 하나에 여러 개씩 달 수 있는 기록. 책 주인과 친구 모두 남길 수 있다. */
export interface BookEntry {
  id: string
  type: EntryType
  text: string
  page?: string // 문장(quote)의 쪽수
  authorId: string
  authorNickname: string
  createdAt: unknown // Firestore Timestamp(읽을 때) 또는 number
  updatedAt?: unknown
}

export const ENTRY_TYPES: { type: EntryType; label: string; icon: string; placeholder: string; maxLength: number }[] = [
  { type: 'quote', label: '인상 깊은 문장', icon: '📜', placeholder: '마음에 남은 문장을 그대로 옮겨 적어요', maxLength: 300 },
  { type: 'feeling', label: '느낀점', icon: '💭', placeholder: '읽고 나서 든 생각이나 감정', maxLength: 500 },
  { type: 'summary', label: '요약', icon: '📝', placeholder: '줄거리나 핵심 내용을 내 말로', maxLength: 500 },
  { type: 'reason', label: '읽은 계기', icon: '🧭', placeholder: '이 책을 어떻게 만나게 됐나요?', maxLength: 200 },
  { type: 'inquiry', label: '탐구 질문', icon: '❓', placeholder: '읽고 더 알고 싶어진 것 한 줄', maxLength: 100 },
  { type: 'reread', label: '다시 읽음', icon: '🔁', placeholder: '다시 읽은 이유나 새로 보인 것(선택)', maxLength: 200 },
  { type: 'opinion', label: '의견', icon: '💬', placeholder: '이 책·기록에 대한 생각을 자유롭게', maxLength: 300 },
]

export function entryTypeInfo(type: EntryType) {
  return ENTRY_TYPES.find((t) => t.type === type)!
}

/** 별 밝기에 들어가는 활동 종류(자유 의견은 제외). */
const BRIGHTNESS_TYPES: EntryType[] = ['quote', 'reason', 'reread', 'summary', 'feeling', 'inquiry']

/** 책에 남은 기록 종류 수로 별 밝기(1~5단계)를 계산한다. 같은 종류를 여러 번 남겨도 한 종류로 센다. */
export function computeBrightness(book: Book): 1 | 2 | 3 | 4 | 5 {
  const kinds = BRIGHTNESS_TYPES.filter((t) => (book.entryCounts?.[t] ?? 0) > 0).length
  if (kinds >= 5) return 5
  if (kinds >= 3) return 4
  if (kinds >= 2) return 3
  if (kinds >= 1) return 2
  return 1
}

export const STAR_DUST_RULES = {
  registerBook: 7, // 제목+저자+별점
  quote: 3, // 문장은 문장마다
  reason: 4,
  reread: 5,
  summary: 6,
  feeling: 6,
  inquiry: 6,
  photo: 8,
  cheerMessage: 3, // 친구 책에 기록·의견을 남길 때
  heart: 1,
  dailyCap: 30,
} as const
