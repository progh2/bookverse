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

  const path = currentPath()
  const handler = routes[path] ?? routes['/']
  const result = await handler(outlet)
  currentCleanup = result ?? undefined

  document.querySelectorAll('.topbar nav a').forEach((a) => {
    a.classList.toggle('active', (a as HTMLAnchorElement).getAttribute('href') === `#${path}`)
  })
}
