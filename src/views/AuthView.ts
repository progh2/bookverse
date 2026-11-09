import { signUp, logIn } from '../lib/accounts'
import { realNameWarning } from '../lib/filter'
import { saveAccountSession, saveSession } from '../lib/session'
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

        <div id="demo-hint" style="background:rgba(255,214,107,0.1); border:1px solid rgba(255,214,107,0.35); border-radius:10px; padding:12px 14px; margin-bottom:16px">
          <p style="margin:0 0 8px; font-size:13px; color:var(--text-dim)">
            예시 계정 — 닉네임 <strong style="color:var(--star-yellow)">데모학생</strong> · 비밀번호 <strong style="color:var(--star-yellow)">1234</strong>
          </p>
          <button type="button" class="btn secondary" id="demo-login-btn" style="width:auto; margin-top:0; padding:8px 14px; font-size:13px">✨ 바로 체험해보기</button>
        </div>

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

  container.querySelector('#demo-login-btn')!.addEventListener('click', async () => {
    setMode('login')
    errorEl.textContent = ''
    const demoBtn = container.querySelector<HTMLButtonElement>('#demo-login-btn')!
    demoBtn.disabled = true
    demoBtn.textContent = '불러오는 중...'
    try {
      const account = await logIn('데모학생', '1234')
      state.account = { accountId: account.id, nickname: account.nickname }
      saveAccountSession(state.account)
      // 데모 계정은 MB7B5X 학급 하나에만 들어가 있어서, 학급 선택 없이 바로 별자리로 이동
      state.session = { classCode: 'MB7B5X', studentId: account.id, nickname: account.nickname }
      saveSession(state.session)
      navigate('/star')
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
      demoBtn.disabled = false
      demoBtn.textContent = '✨ 바로 체험해보기'
    }
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.textContent = ''
    submitBtn.disabled = true
    try {
      const nickname = container.querySelector<HTMLInputElement>('#nickname')!.value
      const pin = container.querySelector<HTMLInputElement>('#pin')!.value
      const warning = mode === 'signup' ? realNameWarning(nickname) : null
      if (warning && !confirm(warning)) return
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
