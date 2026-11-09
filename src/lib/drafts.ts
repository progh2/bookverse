/** 작성 중인 글 임시저장(이 기기 브라우저에만). 창을 닫거나 새로고침해도 이어서 쓸 수 있다. */
const PREFIX = 'bookverse.draft.'

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveDraft(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 저장 공간이 꽉 찼거나 막힌 경우엔 임시저장 없이 계속 쓴다
  }
}

export function clearDraft(key: string) {
  localStorage.removeItem(PREFIX + key)
}
