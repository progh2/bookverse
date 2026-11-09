/**
 * 필사 사진을 Firestore 문서에 바로 담을 수 있게 줄인다(긴 변 최대 1280px, JPEG).
 * 용량 한도(maxLength, data URL 글자 수)에 들어올 때까지 화질·크기를 조금씩 낮춘다.
 */
export async function compressImage(file: File, maxLength: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요.')
  const img = await loadImage(file)
  let side = 1280
  let quality = 0.82
  for (let i = 0; i < 8; i++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff' // 투명 PNG가 JPEG로 바뀌며 검게 되지 않도록
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= maxLength) return url
    if (quality > 0.55) quality -= 0.1
    else side = Math.round(side * 0.8)
  }
  throw new Error('사진이 너무 커서 줄이지 못했어요. 다른 사진을 골라 주세요.')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요.')) }
    img.src = url
  })
}
