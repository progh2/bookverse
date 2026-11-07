// 사이트 전체에 깔리는 고정 우주 배경(반짝이는 잔별 + 은은한 성운 글로우).
// main.ts에서 앱 부트스트랩 시 한 번만 호출되어야 하며, 라우트가 바뀔 때마다
// 다시 그려지면 안 된다(#outlet 바깥, body 레벨에 상주).

const STAR_COUNT = 130
const GLOW_COUNT = 5

function buildStarsHtml(): string {
  let html = ''
  for (let i = 0; i < STAR_COUNT; i++) {
    const left = Math.random() * 100
    const top = Math.random() * 100
    const size = 1 + Math.random() * 2.2
    const delay = Math.random() * 8
    const duration = 3 + Math.random() * 5
    const opacity = 0.35 + Math.random() * 0.65
    html += `<i class="cosmic-star" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${duration}s;--max-opacity:${opacity};"></i>`
  }
  return html
}

function buildGlowsHtml(): string {
  const colors = ['var(--star-yellow)', 'var(--line-blue)']
  let html = ''
  for (let i = 0; i < GLOW_COUNT; i++) {
    const left = Math.random() * 100
    const top = Math.random() * 100
    const sizeVw = 28 + Math.random() * 30
    const color = colors[i % colors.length]
    const opacity = 0.08 + Math.random() * 0.1
    const duration = 14 + Math.random() * 14
    const delay = Math.random() * -20
    html += `<span class="cosmic-glow" style="left:${left}%;top:${top}%;width:${sizeVw}vmax;height:${sizeVw}vmax;--glow-color:${color};--glow-opacity:${opacity};animation-duration:${duration}s;animation-delay:${delay}s;"></span>`
  }
  return html
}

/** 앱 전체에 고정 깔리는 우주 배경(반짝이는 별 + 성운 글로우)을 body에 한 번 마운트한다. */
export function mountCosmicBackground(): void {
  if (document.getElementById('cosmic-bg')) return

  const el = document.createElement('div')
  el.id = 'cosmic-bg'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = `
    <div class="cosmic-glows">${buildGlowsHtml()}</div>
    <div class="cosmic-stars">${buildStarsHtml()}</div>
  `
  document.body.prepend(el)
}
