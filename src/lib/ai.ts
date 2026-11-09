import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { guessGenre } from './genre'

export interface GenreTagResult {
  genre: string
  keywords: string[]
  source: 'ai' | 'fallback'
}

interface GenerateBookTagsResponse {
  genre: string
  keywords: string[]
}

/**
 * 책 제목·저자로 장르 1개·키워드 3개를 추정한다.
 * 교사가 관리자 페이지에서 OpenAI 키를 저장해뒀으면 Cloud Function(generateBookTags)이
 * 서버에서 실제 AI 호출을 대신 해준다(클라이언트는 키를 절대 보지 않음).
 * 키가 없거나 호출이 실패하면 로컬 휴리스틱(guessGenre)으로 조용히 대체한다.
 */
export async function requestGenreTags(
  classCode: string,
  title: string,
  author: string,
  quote?: string,
): Promise<GenreTagResult> {
  try {
    const call = httpsCallable<
      { classCode: string; title: string; author: string; quote?: string },
      GenerateBookTagsResponse
    >(functions, 'generateBookTags')
    const res = await call({ classCode, title, author, quote })
    if (res.data?.genre) {
      return { genre: res.data.genre, keywords: res.data.keywords ?? [], source: 'ai' }
    }
  } catch {
    // 키 미설정, 일일 호출 상한 도달, 네트워크 오류 등 — 조용히 폴백
  }
  const fallback = guessGenre(title)
  return { ...fallback, source: 'fallback' }
}

export interface BookCandidate {
  title: string
  author: string
}

export interface BookSuggestion {
  candidates: BookCandidate[]
  genre: string
  keywords: string[]
  source: 'ai' | 'fallback'
}

/**
 * 제목을 입력하는 도중 AI에게 실제 책 후보(제목+저자)와 장르를 추천받는다.
 * 키가 없거나 실패하면 후보 없이 로컬 추정 장르만 돌려준다(학생이 직접 입력하면 됨).
 */
export async function requestBookSuggestions(classCode: string, title: string): Promise<BookSuggestion> {
  try {
    const call = httpsCallable<{ classCode: string; title: string }, Omit<BookSuggestion, 'source'>>(
      functions, 'suggestBookInfo',
    )
    const res = await call({ classCode, title })
    if (res.data) return { ...res.data, source: 'ai' }
  } catch {
    // 키 미설정·상한 도달·네트워크 오류 — 폴백
  }
  return { candidates: [], ...guessGenre(title), source: 'fallback' }
}

export interface CardLines {
  feeling: string
  question: string
  cheer: string
  source: 'ai' | 'fallback'
}

/** 한 소절 카드 문구 3종. AI를 못 쓰면 문장과 상관없이 어울리는 기본 문구를 준다. */
export async function requestCardLines(
  classCode: string, title: string, author: string, quote: string,
): Promise<CardLines> {
  try {
    const call = httpsCallable<
      { classCode: string; title: string; author: string; quote: string },
      Omit<CardLines, 'source'>
    >(functions, 'suggestCardLines')
    const res = await call({ classCode, title, author, quote })
    if (res.data?.feeling) return { ...res.data, source: 'ai' }
  } catch {
    // 키 미설정·상한 도달·네트워크 오류 — 폴백
  }
  return {
    feeling: '오래 머물고 싶은 문장',
    question: '이 문장은 지금의 나에게 무슨 말을 할까?',
    cheer: '오늘도 한 문장만큼 자란 나에게',
    source: 'fallback',
  }
}
