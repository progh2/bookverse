import type { ClassRoom, Student } from './types'
import { loadSession, type StudentSession } from './lib/session'

export interface AppState {
  session: StudentSession | null
  student: Student | null
  classRoom: ClassRoom | null
}

export const state: AppState = {
  session: loadSession(),
  student: null,
  classRoom: null,
}
