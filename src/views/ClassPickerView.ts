import { getAccount, addClassToAccount } from '../lib/accounts'
import { getClass } from '../lib/classes'
import { joinClass } from '../lib/students'
import { saveSession, saveAccountSession, clearAccountSession } from '../lib/session'
import { state } from '../state'
import { navigate } from '../router'
import { TEMPLATE_OPTIONS } from '../three/constellationLayout'
import { zodiacFromBirthday } from '../lib/zodiac'
import type { ClassRoom, TemplateId, ZodiacSign } from '../types'

export async function renderClassPicker(container: HTMLElement): Promise<void> {
  if (!state.account) {
    navigate('/auth')
    return
  }

  container.innerHTML = `
    <div class="view">
      <div class="panel">
        <h1>⭐ ${escapeHtml(state.account.nickname)}님, 어느 학급으로 들어갈까요?</h1>
        <button class="btn secondary" id="logout" style="width:auto">로그아웃</button>

        <div id="my-classes" style="margin-top:20px"></div>

        <hr style="border-color: rgba(255,255,255,0.1); margin: 28px 0" />

        <h2 style="font-size:16px">새 학급에 들어가기</h2>
        <form id="join-class-form">
          <label for="class-code">학급 코드 (6자리)</label>
          <input id="class-code" maxlength="6" placeholder="예: AB3C7D" autocomplete="off" required />

          <label for="template-select">별자리 템플릿 고르기</label>
          <select id="template-select">
            <optgroup label="유명한 별자리">
              ${TEMPLATE_OPTIONS.filter((t) => t.group === 'famous').map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
            </optgroup>
            <optgroup label="12궁 별자리">
              ${TEMPLATE_OPTIONS.filter((t) => t.group === 'zodiac').map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
            </optgroup>
          </select>
          <p class="hint">생일의 월·일을 넣으면 어울리는 12궁 템플릿을 추천해줘요(값은 저장하지 않아요).</p>
          <div style="display:flex; gap:10px">
            <input id="birthday-month" type="number" min="1" max="12" placeholder="월" />
            <input id="birthday-day" type="number" min="1" max="31" placeholder="일" />
            <button type="button" class="btn secondary" id="suggest-btn" style="width:auto; white-space:nowrap">추천받기</button>
          </div>

          <button class="btn" type="submit" id="join-submit">학급 들어가기</button>
          <p class="error-text" id="join-error"></p>
        </form>
      </div>
    </div>
  `

  container.querySelector('#logout')!.addEventListener('click', () => {
    clearAccountSession()
    state.account = null
    state.session = null
    navigate('/')
  })

  container.querySelector('#suggest-btn')!.addEventListener('click', () => {
    const month = Number(container.querySelector<HTMLInputElement>('#birthday-month')!.value)
    const day = Number(container.querySelector<HTMLInputElement>('#birthday-day')!.value)
    if (!month || !day) return
    const zodiac: ZodiacSign = zodiacFromBirthday(month, day)
    container.querySelector<HTMLSelectElement>('#template-select')!.value = zodiac
  })

  const account = await getAccount(state.account.accountId)
  const myClasses = account?.classCodes ?? []
  const classListEl = container.querySelector<HTMLElement>('#my-classes')!

  if (myClasses.length === 0) {
    classListEl.innerHTML = '<p class="hint">아직 들어간 학급이 없어요. 아래에서 학급 코드로 들어가 보세요.</p>'
  } else {
    classListEl.innerHTML = '<p class="hint">불러오는 중...</p>'
    const classes = (await Promise.all(myClasses.map((code) => getClass(code)))).filter(
      (c): c is ClassRoom => c !== null,
    )
    classListEl.innerHTML = classes
      .map(
        (c) => `
        <div class="choice-card" data-code="${c.code}" style="margin-bottom:10px; cursor:pointer">
          <h2>${escapeHtml(c.name)}</h2>
          <p>코드 ${c.code}</p>
        </div>
      `,
      )
      .join('')
    classListEl.querySelectorAll<HTMLElement>('[data-code]').forEach((el) => {
      const code = el.dataset.code!
      el.addEventListener('click', () => enterClass(code, classes.find((c) => c.code === code) ?? null))
    })
  }

  function enterClass(code: string, classRoom: ClassRoom | null = null) {
    state.classRoom = classRoom
    state.session = { classCode: code, studentId: state.account!.accountId, nickname: state.account!.nickname }
    saveSession(state.session)
    navigate('/star')
  }

  const form = container.querySelector<HTMLFormElement>('#join-class-form')!
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = container.querySelector<HTMLElement>('#join-error')!
    const submitBtn = container.querySelector<HTMLButtonElement>('#join-submit')!
    errorEl.textContent = ''
    submitBtn.disabled = true
    try {
      const code = container.querySelector<HTMLInputElement>('#class-code')!.value.trim().toUpperCase()
      const template = container.querySelector<HTMLSelectElement>('#template-select')!.value as TemplateId
      if (code.length !== 6) throw new Error('학급 코드는 6자리예요.')

      const classRoom = await getClass(code)
      if (!classRoom) throw new Error('존재하지 않는 학급 코드예요. 선생님께 확인해 주세요.')

      await joinClass(state.account!.accountId, code, state.account!.nickname, template)
      await addClassToAccount(state.account!.accountId, code)
      saveAccountSession(state.account!) // 세션 자체는 안 바뀌지만 최신 상태 보장

      enterClass(code, classRoom)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
    } finally {
      submitBtn.disabled = false
    }
  })
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
