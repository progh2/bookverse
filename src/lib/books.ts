import {
  addDoc, collection, collectionGroup, deleteField, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Book } from '../types'

function booksCol(classCode: string, studentId: string) {
  return collection(db, 'classes', classCode, 'students', studentId, 'books')
}

/** 기록을 더하거나 고친 뒤 개수·문장 키 등이 반영된 최신 책 문서를 다시 읽는다. */
export async function getBook(book: Pick<Book, 'classCode' | 'studentId' | 'id'>): Promise<Book | null> {
  const snap = await getDoc(doc(db, 'classes', book.classCode, 'students', book.studentId, 'books', book.id))
  return snap.exists() ? { ...(snap.data() as Omit<Book, 'id'>), id: snap.id } : null
}

export async function listBooks(classCode: string, studentId: string): Promise<Book[]> {
  const snap = await getDocs(booksCol(classCode, studentId))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Book, 'id'>), id: d.id }))
}

/** 학급 전체 책(성운 뷰용). 컬렉션 그룹 쿼리로 모든 학생의 books 서브컬렉션을 한 번에 읽는다. */
export async function listClassBooks(classCode: string): Promise<Book[]> {
  const q = query(collectionGroup(db, 'books'), where('classCode', '==', classCode))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Book, 'id'>), id: d.id }))
}

export type NewBookInput = Omit<Book, 'id' | 'studentId' | 'createdAt' | 'classCode'>

/**
 * 같은 제목+저자가 이미 있으면 새 별을 만들지 않고 기존 별을 돌려준다(isNew=false).
 * 문장·느낀점 같은 기록은 등록 이후 상세 화면에서 entries로 따로 더한다.
 */
export async function upsertBook(
  classCode: string,
  studentId: string,
  input: NewBookInput,
): Promise<{ book: Book; isNew: boolean }> {
  const existingBooks = await listBooks(classCode, studentId)
  const dup = existingBooks.find(
    (b) => b.title.trim() === input.title.trim() && b.author.trim() === input.author.trim(),
  )
  if (dup) return { book: dup, isNew: false }

  const newBook: Omit<Book, 'id'> = {
    ...input,
    studentId,
    classCode, // collectionGroup 쿼리용
    createdAt: Date.now(),
  }
  // Firestore는 undefined 필드 값을 거부한다 — 비워둔 선택 입력(quote, summary 등)은
  // input에 undefined로 들어오므로 쓰기 전에 걷어내야 한다.
  const ref = await addDoc(booksCol(classCode, studentId), omitUndefined({
    ...newBook,
    createdAt: serverTimestamp(),
  }))
  return { book: { ...newBook, id: ref.id }, isNew: true }
}

/** 학생 본인이 자기 책 내용을 직접 고친다(게시판/상세 화면의 '수정'). 별가루는 다시 지급하지 않는다. */
export async function updateBook(
  classCode: string,
  studentId: string,
  bookId: string,
  patch: NewBookInput,
) {
  await updateDoc(
    doc(db, 'classes', classCode, 'students', studentId, 'books', bookId),
    omitUndefined(patch as unknown as Record<string, unknown>),
  )
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value
  }
  return result
}

/** 큰 별 지정/해제(마음에 남은 책). 해제하면 이유도 지운다. */
export async function setBigStar(book: Book, isBigStar: boolean, reason = '') {
  await updateDoc(doc(db, 'classes', book.classCode, 'students', book.studentId, 'books', book.id), {
    isBigStar,
    bigStarReason: isBigStar ? reason.trim().slice(0, 30) : deleteField(),
  })
}
