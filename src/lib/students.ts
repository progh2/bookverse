import {
  arrayRemove, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Student, StarPosition, TemplateId } from '../types'

function studentsCol(classCode: string) {
  return collection(db, 'classes', classCode, 'students')
}

/** 이미 전역 계정이 있는 학생이 학급에 처음 들어간다(또는 이미 들어가 있으면 그대로 돌려준다). */
export async function joinClass(
  accountId: string,
  classCode: string,
  nickname: string,
  template: TemplateId,
): Promise<Student> {
  const ref = doc(db, 'classes', classCode, 'students', accountId)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    return { ...(existing.data() as Omit<Student, 'id'>), id: accountId }
  }

  const today = kstDateString()
  const newStudent: Omit<Student, 'id'> = {
    classCode,
    nickname,
    constellationTemplate: template,
    starDust: 0,
    dailyEarned: 0,
    lastEarnDate: today,
    createdAt: Date.now(),
  }
  await setDoc(ref, { ...newStudent, createdAt: serverTimestamp() })
  return { ...newStudent, id: accountId }
}

export async function getStudent(classCode: string, studentId: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, 'classes', classCode, 'students', studentId))
  if (!snap.exists()) return null
  return { ...(snap.data() as Omit<Student, 'id'>), id: snap.id }
}

export async function listStudents(classCode: string): Promise<Student[]> {
  const snap = await getDocs(studentsCol(classCode))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Student, 'id'>), id: d.id }))
}

export function kstDateString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** 하루 적립 상한(기본 30)을 적용해 별가루를 더한다. 상한을 넘는 만큼은 버린다. */
export async function earnStarDust(classCode: string, studentId: string, amount: number, cap = 30) {
  const ref = doc(db, 'classes', classCode, 'students', studentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as Omit<Student, 'id'>
  const today = kstDateString()
  const dailyEarned = data.lastEarnDate === today ? data.dailyEarned : 0
  const room = Math.max(0, cap - dailyEarned)
  const granted = Math.min(room, amount)
  await updateDoc(ref, {
    starDust: data.starDust + granted,
    dailyEarned: dailyEarned + granted,
    lastEarnDate: today,
  })
  return granted
}

/** 별자리 템플릿을 바꾼다(편집기에서 템플릿을 다시 고를 때). 기존 커스텀 배치는 초기화된다. */
export async function setConstellationTemplate(classCode: string, studentId: string, template: TemplateId) {
  await updateDoc(doc(db, 'classes', classCode, 'students', studentId), {
    constellationTemplate: template,
    starPositions: {},
  })
}

/** 편집기에서 학생이 직접 옮긴 별 좌표를 저장한다(bookId -> {x,y}). */
export async function saveStarPositions(
  classCode: string,
  studentId: string,
  positions: Record<string, StarPosition>,
) {
  await updateDoc(doc(db, 'classes', classCode, 'students', studentId), { starPositions: positions })
}

/** 학생과 책 데이터를 모두 지운다(교사 전용 작업). 전역 계정 자체는 남고, 이 학급만 목록에서 빠진다. */
export async function deleteStudent(classCode: string, studentId: string) {
  const booksSnap = await getDocs(collection(db, 'classes', classCode, 'students', studentId, 'books'))
  await Promise.all(booksSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'classes', classCode, 'students', studentId))
  await updateDoc(doc(db, 'students', studentId), { classCodes: arrayRemove(classCode) }).catch(() => {})
}
