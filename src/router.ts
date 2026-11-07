export type CleanupFn = (() => void) | void

type RouteHandler = (container: HTMLElement) => CleanupFn | Promise<CleanupFn>

const routes: Record<string, RouteHandler> = {}
let currentCleanup: CleanupFn = undefined
let outlet: HTMLElement | null = null

export function registerRoute(path: string, handler: RouteHandler) {
  routes[path] = handler
}

export function navigate(path: string) {
  location.hash = `#${path}`
}

export function setOutlet(el: HTMLElement) {
  outlet = el
  window.addEventListener('hashchange', dispatch)
  dispatch()
}

function currentPath(): string {
  const hash = location.hash.replace(/^#/, '')
  const [path] = hash.split('?')
  return path || '/'
}

async function dispatch() {
  if (!outlet) return
  if (typeof currentCleanup === 'function') currentCleanup()
  currentCleanup = undefined

  await playExitTransition(outlet)

  const path = currentPath()
  const handler = routes[path] ?? routes['/']
  const result = await handler(outlet)
  currentCleanup = result ?? undefined

  playEnterTransition(outlet)

  document.querySelectorAll('.topbar nav a').forEach((a) => {
    a.classList.toggle('active', (a as HTMLAnchorElement).getAttribute('href') === `#${path}`)
  })
}

/** 화면 전환 시 이전 화면을 3D로 밀어내는 효과. 첫 로드에는 나갈 화면이 없으므로 건너뛴다. */
function playExitTransition(el: HTMLElement): Promise<void> {
  if (!el.dataset.mounted) {
    el.dataset.mounted = '1'
    return Promise.resolve()
  }
  el.classList.remove('view-enter', 'view-enter-start')
  el.classList.add('view-exit')
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', finish)
      resolve()
    }
    el.addEventListener('transitionend', finish, { once: true })
    setTimeout(finish, 260) // transitionend 유실 대비 폴백
  })
}

/** 새 화면이 반대 방향에서 3D로 들어오는 효과. */
function playEnterTransition(el: HTMLElement) {
  el.classList.remove('view-exit')
  el.classList.add('view-enter-start')
  void el.offsetWidth // 강제 reflow로 시작 상태를 먼저 적용
  requestAnimationFrame(() => {
    el.classList.remove('view-enter-start')
    el.classList.add('view-enter')
  })
}
