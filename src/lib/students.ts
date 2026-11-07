import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Student, ZodiacSign } from '../types'
import { sha256Hex, randomPin } from './crypto'

function studentsCol(classCode: string) {
  return collection(db, 'classes', classCode, 'students')
}

/** 닉네임+PIN으로 입장한다. 처음 보는 닉네임이면 새로 만들고, 있으면 PIN을 검증한다. */
export async function joinOrLogin(
  classCode: string,
  nickname: string,
  pin: string,
  zodiac: ZodiacSign | null,
): Promise<{ student: Student; isNew: boolean }> {
  const pinHash = await sha256Hex(pin)
  const q = query(studentsCol(classCode), where('nickname', '==', nickname))
  const snap = await getDocs(q)

  if (!snap.empty) {
    const existing = snap.docs[0]
    const data = existing.data() as Omit<Student, 'id'>
    if (data.pinHash !== pinHash) {
      throw new Error('PIN_MISMATCH')
    }
    return { student: { ...data, id: existing.id }, isNew: false }
  }

  const today = kstDateString()
  const newStudent: Omit<Student, 'id'> = {
    classCode,
    nickname,
    pinHash,
    zodiac,
    starDust: 0,
    dailyEarned: 0,
    lastEarnDate: today,
    createdAt: Date.now(),
  }
  const ref = await addDoc(studentsCol(classCode), { ...newStudent, createdAt: serverTimestamp() })
  return { student: { ...newStudent, id: ref.id }, isNew: true }
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

/** 닉네임을 바꾼다. 같은 학급 안에 이미 쓰는 닉네임이면 거부한다. */
export async function renameStudent(classCode: string, studentId: string, newNickname: string) {
  const name = newNickname.trim()
  if (!name) throw new Error('닉네임을 입력해 주세요.')
  const q = query(studentsCol(classCode), where('nickname', '==', name))
  const snap = await getDocs(q)
  const taken = snap.docs.some((d) => d.id !== studentId)
  if (taken) throw new Error('이미 같은 학급에서 쓰고 있는 닉네임이에요.')
  await updateDoc(doc(db, 'classes', classCode, 'students', studentId), { nickname: name })
}

/** 교사가 학생 비밀번호를 초기화한다. 새 PIN을 생성해 반환하니 학생에게 알려줘야 한다. */
export async function resetStudentPin(classCode: string, studentId: string): Promise<string> {
  const pin = randomPin()
  const pinHash = await sha256Hex(pin)
  await updateDoc(doc(db, 'classes', classCode, 'students', studentId), { pinHash })
  return pin
}

/** 학생과 책 데이터를 모두 지운다(교사 전용 작업). */
export async function deleteStudent(classCode: string, studentId: string) {
  const booksSnap = await getDocs(collection(db, 'classes', classCode, 'students', studentId, 'books'))
  await Promise.all(booksSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'classes', classCode, 'students', studentId))
}
