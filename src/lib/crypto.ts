/** PIN을 평문으로 저장하지 않기 위한 단순 해시(해커톤 범위 — 강한 보안 보장 아님). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 혼동되는 0/O, 1/I 제외
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}
