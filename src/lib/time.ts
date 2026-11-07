/** Firestore에서 읽어온 시간은 Timestamp 객체로 오고, 방금 로컬에서 만든 값은 number다. */
export function toMillis(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000
  }
  return 0
}

export function formatDateTime(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}
