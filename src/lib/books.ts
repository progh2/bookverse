import {
  addDoc, collection, collectionGroup, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Book } from '../types'

function booksCol(classCode: string, studentId: string) {
  return collection(db, 'classes', classCode, 'students', studentId, 'books')
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

/** 같은 제목+저자가 이미 있으면 활동을 덧붙이고, 없으면 새 별을 만든다. */
export async function upsertBook(
  classCode: string,
  studentId: string,
  input: NewBookInput,
): Promise<{ book: Book; isNew: boolean }> {
  const existingBooks = await listBooks(classCode, studentId)
  const dup = existingBooks.find(
    (b) => b.title.trim() === input.title.trim() && b.author.trim() === input.author.trim(),
  )

  if (dup) {
    const merged: Partial<Book> = {}
    for (const [key, value] of Object.entries(input) as [keyof NewBookInput, unknown][]) {
      const current = (dup as unknown as Record<string, unknown>)[key]
      const isEmpty = current === undefined || current === null || current === '' || current === false
      if (isEmpty && value !== undefined && value !== null && value !== '') {
        ;(merged as Record<string, unknown>)[key] = value
      }
    }
    await updateDoc(doc(db, 'classes', classCode, 'students', studentId, 'books', dup.id), merged)
    return { book: { ...dup, ...merged }, isNew: false }
  }

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

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value
  }
  return result
}
