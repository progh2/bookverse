import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export interface BookComment {
  id: string
  authorId: string
  authorNickname: string
  text: string
  createdAt: unknown // Firestore Timestamp(읽을 때) 또는 number
}

function commentsCol(classCode: string, studentId: string, bookId: string) {
  return collection(db, 'classes', classCode, 'students', studentId, 'books', bookId, 'comments')
}

export async function listComments(classCode: string, studentId: string, bookId: string): Promise<BookComment[]> {
  const snap = await getDocs(query(commentsCol(classCode, studentId, bookId), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BookComment, 'id'>), id: d.id }))
}

export async function addComment(
  classCode: string,
  studentId: string,
  bookId: string,
  author: { id: string; nickname: string },
  text: string,
) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('의견을 입력해 주세요.')
  if (trimmed.length > 300) throw new Error('의견은 300자 이내로 써 주세요.')
  await addDoc(commentsCol(classCode, studentId, bookId), {
    authorId: author.id,
    authorNickname: author.nickname,
    text: trimmed,
    createdAt: serverTimestamp(),
  })
}

export async function deleteComment(classCode: string, studentId: string, bookId: string, commentId: string) {
  await deleteDoc(doc(db, 'classes', classCode, 'students', studentId, 'books', bookId, 'comments', commentId))
}
