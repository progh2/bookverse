import { signUp, logIn } from '../lib/accounts'
import { saveAccountSession } from '../lib/session'
import { state } from '../state'
import { navigate } from '../router'

export function renderAuth(container: HTMLElement) {
  container.innerHTML = `
    <div class="view">
      <div class="center-card">
        <div style="display:flex; gap:8px; margin-bottom:10px">
          <button class="btn secondary tab-btn active" id="tab-login" style="margin-top:0">로그인</button>
          <button class="btn secondary tab-btn" id="tab-signup" style="margin-top:0">회원가입</button>
        </div>
        <h1 id="auth-title">⭐ 로그인</h1>
        <p class="sub" id="auth-sub">닉네임과 비밀번호로 로그인해요. 여러 학급에 들어가 있어도 하나의 계정으로 모두 관리돼요.</p>

        <form id="auth-form">
          <label for="nickname">닉네임</label>
          <input id="nickname" maxlength="12" autocomplete="off" required />

          <label for="pin">숫자 4자리 비밀번호</label>
          <input id="pin" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" placeholder="••••" required />

          <button class="btn" type="submit" id="auth-submit">로그인</button>
          <p class="error-text" id="auth-error"></p>
        </form>
      </div>
    </div>
  `

  let mode: 'login' | 'signup' = 'login'

  const tabLogin = container.querySelector<HTMLButtonElement>('#tab-login')!
  const tabSignup = container.querySelector<HTMLButtonElement>('#tab-signup')!
  const title = container.querySelector<HTMLElement>('#auth-title')!
  const sub = container.querySelector<HTMLElement>('#auth-sub')!
  const submitBtn = container.querySelector<HTMLButtonElement>('#auth-submit')!
  const errorEl = container.querySelector<HTMLElement>('#auth-error')!
  const form = container.querySelector<HTMLFormElement>('#auth-form')!

  function setMode(next: 'login' | 'signup') {
    mode = next
    tabLogin.classList.toggle('active', mode === 'login')
    tabSignup.classList.toggle('active', mode === 'signup')
    if (mode === 'login') {
      title.textContent = '⭐ 로그인'
      sub.textContent = '닉네임과 비밀번호로 로그인해요. 여러 학급에 들어가 있어도 하나의 계정으로 모두 관리돼요.'
      submitBtn.textContent = '로그인'
    } else {
      title.textContent = '⭐ 회원가입'
      sub.textContent = '이메일 없이, 닉네임과 숫자 4자리 비밀번호만으로 계정을 만들어요. 닉네임은 다른 학생과 겹치면 안 돼요.'
      submitBtn.textContent = '계정 만들기'
    }
    errorEl.textContent = ''
  }

  tabLogin.addEventListener('click', () => setMode('login'))
  tabSignup.addEventListener('click', () => setMode('signup'))

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.textContent = ''
    submitBtn.disabled = true
    try {
      const nickname = container.querySelector<HTMLInputElement>('#nickname')!.value
      const pin = container.querySelector<HTMLInputElement>('#pin')!.value
      const account = mode === 'login' ? await logIn(nickname, pin) : await signUp(nickname, pin)
      state.account = { accountId: account.id, nickname: account.nickname }
      saveAccountSession(state.account)
      navigate('/classes')
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
    } finally {
      submitBtn.disabled = false
    }
  })
}
