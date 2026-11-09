import {
  collection, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
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

/** 지금 구글로 로그인한 교사가 이 학급의 담당 교사인지(책·기록 개별 삭제 권한 확인용). */
export async function isTeacherOf(classCode: string): Promise<boolean> {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) return false
  const c = await getClass(classCode)
  return c?.teacherUid === uid
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

/**
 * OpenAI API 키를 저장한다. 실제 키는 "쓰기 전용" 비밀 문서(classes/{code}/secrets/openai)에
 * 들어가고 Firestore 규칙상 클라이언트는 이 문서를 절대 읽을 수 없다(Cloud Function만 Admin
 * SDK로 읽음). 저장 여부 표시용 플래그만 classes/{code} 문서에 따로 남긴다.
 */
export async function saveOpenAiKey(classCode: string, apiKey: string) {
  await setDoc(doc(db, 'classes', classCode, 'secrets', 'openai'), {
    apiKey,
    updatedAt: serverTimestamp(),
    dailyCallCount: 0,
    lastCallDate: '',
  })
  await updateDoc(doc(db, 'classes', classCode), {
    openaiKeyConfigured: true,
    openaiKeyUpdatedAt: Date.now(),
  })
}

export async function clearOpenAiKey(classCode: string) {
  await setDoc(doc(db, 'classes', classCode, 'secrets', 'openai'), {
    apiKey: '',
    updatedAt: serverTimestamp(),
    dailyCallCount: 0,
    lastCallDate: '',
  })
  await updateDoc(doc(db, 'classes', classCode), {
    openaiKeyConfigured: false,
    openaiKeyUpdatedAt: deleteField(),
  })
}
