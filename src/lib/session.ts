export interface StudentSession {
  classCode: string
  studentId: string
  nickname: string
}

const KEY = 'bookverse.session'

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
