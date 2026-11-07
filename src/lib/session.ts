export interface StudentSession {
  classCode: string
  studentId: string
  nickname: string
}

export interface AccountSession {
  accountId: string
  nickname: string
}

const KEY = 'bookverse.session'
const ACCOUNT_KEY = 'bookverse.account'

export function saveSession(session: StudentSession) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function loadSession(): StudentSession | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StudentSession
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(KEY)
}

/** 로그인 상태(계정)는 특정 학급 세션과 별개로 유지된다 — 학급을 바꿔도 로그인은 유지. */
export function saveAccountSession(session: AccountSession) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(session))
}

export function loadAccountSession(): AccountSession | null {
  const raw = localStorage.getItem(ACCOUNT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AccountSession
  } catch {
    return null
  }
}

export function clearAccountSession() {
  localStorage.removeItem(ACCOUNT_KEY)
  clearSession()
}
