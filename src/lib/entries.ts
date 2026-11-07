import {
  arrayRemove, arrayUnion, collection, doc, getDocs, increment, orderBy, query,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { entryTypeInfo, STAR_DUST_RULES, type Book, type BookEntry, type EntryType } from '../types'
import { earnStarDust } from './students'

export interface Viewer {
  classCode: string
  studentId: string
  nickname: string
}

/** 띄어쓰기·따옴표·문장부호 차이를 무시하고 같은 문장인지 비교하기 위한 키. */
export function normalizeQuote(s: string): string {
  return s.replace(/\s+/g, '').replace(/["'“”‘’.,!?…·~\-()[\]]/g, '')
}

function bookRef(book: Book) {
  return doc(db, 'classes', book.classCode, 'students', book.studentId, 'books', book.id)
}

function entriesCol(book: Book) {
  return collection(bookRef(book), 'entries')
}

export async function listEntries(book: Book): Promise<BookEntry[]> {
  const snap = await getDocs(query(entriesCol(book), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BookEntry, 'id'>), id: d.id }))
}

function validate(type: EntryType, text: string) {
  const info = entryTypeInfo(type)
  if (!text && type !== 'reread') throw new Error(`${info.label}을(를) 입력해 주세요.`)
  if (text.length > info.maxLength) throw new Error(`${info.label}은(는) ${info.maxLength}자 이내로 써 주세요.`)
}

/**
 * 책에 기록을 하나 더한다. 별가루 규칙(중복 적립 방지):
 * - 책 주인: 같은 종류는 책마다 처음 한 번만(문장은 서로 다른 문장마다), 의견은 지급 없음
 * - 친구: 남의 책에 기록을 남기면 응원 별가루(하루 적립 상한 적용)
 * 반환값은 실제로 받은 별가루(상한에 걸리면 0일 수 있음).
 */
export async function addEntry(book: Book, viewer: Viewer, type: EntryType, rawText: string, rawPage = ''): Promise<number> {
  const text = rawText.trim()
  const page = rawPage.trim()
  validate(type, text)

  const isOwner = viewer.studentId === book.studentId
  const quoteKey = type === 'quote' ? normalizeQuote(text) : ''
  let dust = 0
  let markEarned = false
  if (isOwner) {
    if (type === 'quote') {
      if (!(book.quoteKeys ?? []).includes(quoteKey)) dust = STAR_DUST_RULES.quote
    } else if (type !== 'opinion' && !(book.earnedTypes ?? []).includes(type)) {
      dust = STAR_DUST_RULES[type]
      markEarned = true
    }
  } else {
    dust = STAR_DUST_RULES.cheerMessage
  }

  const batch = writeBatch(db)
  batch.set(doc(entriesCol(book)), {
    type,
    text,
    ...(type === 'quote' && page ? { page } : {}),
    authorId: viewer.studentId,
    authorNickname: viewer.nickname,
    createdAt: serverTimestamp(),
  })
  batch.update(bookRef(book), {
    [`entryCounts.${type}`]: increment(1),
    ...(quoteKey ? { quoteKeys: arrayUnion(quoteKey) } : {}),
    ...(markEarned ? { earnedTypes: arrayUnion(type) } : {}),
  })
  await batch.commit()

  return dust > 0 ? ((await earnStarDust(viewer.classCode, viewer.studentId, dust)) ?? 0) : 0
}

export async function updateEntry(book: Book, entry: BookEntry, rawText: string, rawPage = '') {
  const text = rawText.trim()
  const page = rawPage.trim()
  validate(entry.type, text)

  const batch = writeBatch(db)
  batch.update(doc(entriesCol(book), entry.id), {
    text,
    ...(entry.type === 'quote' ? { page } : {}),
    updatedAt: serverTimestamp(),
  })
  if (entry.type === 'quote') {
    const oldKey = normalizeQuote(entry.text)
    const newKey = normalizeQuote(text)
    if (oldKey !== newKey) {
      batch.update(bookRef(book), { quoteKeys: arrayRemove(oldKey) })
      batch.update(bookRef(book), { quoteKeys: arrayUnion(newKey) })
    }
  }
  await batch.commit()
}

export async function deleteEntry(book: Book, entry: BookEntry) {
  const batch = writeBatch(db)
  batch.delete(doc(entriesCol(book), entry.id))
  batch.update(bookRef(book), {
    [`entryCounts.${entry.type}`]: increment(-1),
    ...(entry.type === 'quote' ? { quoteKeys: arrayRemove(normalizeQuote(entry.text)) } : {}),
  })
  await batch.commit()
}
