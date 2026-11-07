import {
  collection, doc, getDoc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ClassRoom } from '../types'
import { randomClassCode } from './crypto'

export async function createClass(teacherUid: string, name: string): Promise<ClassRoom> {
  let code = randomClassCode()
  // 충돌 시 재시도 (해커톤 범위: 최대 5회)
  for (let i = 0; i < 5; i++) {
    const existing = await getDoc(doc(db, 'classes', code))
    if (!existing.exists()) break
    code = randomClassCode()
  }
  const classRoom: ClassRoom = {
    code,
    name,
    teacherUid,
    nebulaVisible: true,
    rankingVisible: true,
    createdAt: Date.now(),
  }
  await setDoc(doc(db, 'classes', code), { ...classRoom, createdAt: serverTimestamp() })
  return classRoom
}

export async function getClass(code: string): Promise<ClassRoom | null> {
  const snap = await getDoc(doc(db, 'classes', code.toUpperCase()))
  if (!snap.exists()) return null
  return snap.data() as ClassRoom
}

export async function setClassVisibility(
  code: string,
  patch: Partial<Pick<ClassRoom, 'nebulaVisible' | 'rankingVisible'>>,
) {
  await updateDoc(doc(db, 'classes', code), patch)
}

export function classesCollection() {
  return collection(db, 'classes')
}
