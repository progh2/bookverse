import {
  addDoc, arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { StudentAccount } from '../types'
import { sha256Hex, randomPin } from './crypto'
import { assertCleanNickname } from './filter'

function accountsCol() {
  return collection(db, 'students')
}

/** 전역 학생 계정을 새로 만든다(이메일·실명 없이 닉네임+PIN). 닉네임은 앱 전체에서 유일해야 한다. */
export async function signUp(nickname: string, pin: string): Promise<StudentAccount> {
  const name = nickname.trim()
  if (!name) throw new Error('닉네임을 입력해 주세요.')
  assertCleanNickname(name)
  if (!/^\d{4}$/.test(pin)) throw new Error('비밀번호는 숫자 4자리예요.')

  const existing = await getDocs(query(accountsCol(), where('nickname', '==', name)))
  if (!existing.empty) throw new Error('이미 사용 중인 닉네임이에요. 다른 닉네임을 써주세요.')

  const pinHash = await sha256Hex(pin)
  const account: Omit<StudentAccount, 'id'> = { nickname: name, pinHash, classCodes: [], createdAt: Date.now() }
  const ref = await addDoc(accountsCol(), { ...account, createdAt: serverTimestamp() })
  return { ...account, id: ref.id }
}

export async function logIn(nickname: string, pin: string): Promise<StudentAccount> {
  const name = nickname.trim()
  if (!name || !pin) throw new Error('닉네임과 비밀번호를 입력해 주세요.')
  const pinHash = await sha256Hex(pin)

  const snap = await getDocs(query(accountsCol(), where('nickname', '==', name)))
  if (snap.empty) throw new Error('존재하지 않는 닉네임이에요. 회원가입을 먼저 해주세요.')

  const accountDoc = snap.docs[0]
  const data = accountDoc.data() as Omit<StudentAccount, 'id'>
  if (data.pinHash !== pinHash) throw new Error('비밀번호가 일치하지 않아요.')
  return { ...data, id: accountDoc.id }
}

export async function getAccount(accountId: string): Promise<StudentAccount | null> {
  const snap = await getDoc(doc(db, 'students', accountId))
  if (!snap.exists()) return null
  return { ...(snap.data() as Omit<StudentAccount, 'id'>), id: snap.id }
}

export async function addClassToAccount(accountId: string, classCode: string) {
  await updateDoc(doc(db, 'students', accountId), { classCodes: arrayUnion(classCode) })
}

/** 닉네임을 바꾼다. 계정 문서와, 그 학생이 속한 모든 학급의 명단 표시용 복사본을 함께 갱신한다. */
export async function renameAccount(accountId: string, newNickname: string, classCodes: string[]) {
  const name = newNickname.trim()
  if (!name) throw new Error('닉네임을 입력해 주세요.')
  assertCleanNickname(name)

  const existing = await getDocs(query(accountsCol(), where('nickname', '==', name)))
  const taken = existing.docs.some((d) => d.id !== accountId)
  if (taken) throw new Error('이미 사용 중인 닉네임이에요.')

  await updateDoc(doc(db, 'students', accountId), { nickname: name })
  await Promise.all(
    classCodes.map((code) =>
      updateDoc(doc(db, 'classes', code, 'students', accountId), { nickname: name }).catch(() => {}),
    ),
  )
}

/** 교사가 학생 비밀번호를 초기화한다(전역 계정 PIN). 새 PIN을 반환하니 학생에게 알려줘야 한다. */
export async function resetAccountPin(accountId: string): Promise<string> {
  const pin = randomPin()
  const pinHash = await sha256Hex(pin)
  await updateDoc(doc(db, 'students', accountId), { pinHash })
  return pin
}
