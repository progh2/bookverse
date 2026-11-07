import type { ClassRoom, Student } from './types'
import { loadSession, loadAccountSession, type StudentSession, type AccountSession } from './lib/session'

export interface AppState {
  account: AccountSession | null
  session: StudentSession | null
  student: Student | null
  classRoom: ClassRoom | null
}

export const state: AppState = {
  account: loadAccountSession(),
  session: loadSession(),
  student: null,
  classRoom: null,
}
