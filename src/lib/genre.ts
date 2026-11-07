import { GENRE_COLORS } from '../types'

export const GENRE_OPTIONS = Object.keys(GENRE_COLORS)

/**
 * 장르·키워드 자동 추정. 실제 생성형 AI API가 아직 연결되지 않았으므로(README 참고),
 * 책 제목의 간단한 키워드 매칭으로 대체한다. 결과에는 항상 'AI 추정' 표시를 붙이고
 * 학생이 고칠 수 있게 한다 — PRD 04탭 '연결 상태: 미연결' 대응.
 */
export function guessGenre(title: string): { genre: string; keywords: string[] } {
  const t = title.toLowerCase()
  const table: [string, string][] = [
    ['시집', '시'], ['시', '시'], ['에세이', '에세이'], ['역사', '역사'], ['과학', '과학'],
    ['우주', '과학'], ['철학', '인문'], ['인문', '인문'],
  ]
  const hit = table.find(([kw]) => t.includes(kw))
  const genre = hit ? hit[1] : '소설'
  return { genre, keywords: [genre, '독서', '밑줄'] }
}
