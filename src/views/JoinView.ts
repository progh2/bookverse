import { getClass } from '../lib/classes'
import { joinOrLogin } from '../lib/students'
import { saveSession } from '../lib/session'
import { zodiacFromBirthday, zodiacNameKo, ZODIAC_LIST } from '../lib/zodiac'
import type { ZodiacSign } from '../types'
import { state } from '../state'
import { navigate } from '../router'

export function renderJoin(container: HTMLElement) {
  container.innerHTML = `
    <div class="view">
      <form class="center-card" id="join-form">
        <h1>⭐ 학생 입장</h1>
        <p class="sub">이메일 가입 없이, 학급 코드와 닉네임·숫자 4자리 비밀번호로 들어가요.</p>

        <label for="code">학급 코드 (6자리)</label>
        <input id="code" maxlength="6" placeholder="예: AB3C7D" autocomplete="off" required />

        <label for="nickname">닉네임</label>
        <input id="nickname" maxlength="12" placeholder="별명을 지어주세요" autocomplete="off" required />

        <label for="pin">숫자 4자리 비밀번호</label>
        <input id="pin" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" placeholder="••••" required />

        <label for="zodiac-mode">내 별자리 기본 윤곽</label>
        <select id="zodiac-mode">
          <option value="birthday">생일(월·일)로 정하기 — 값은 저장하지 않아요</option>
          <option value="manual">12궁 중 직접 고르기</option>
        </select>

        <div id="birthday-fields">
          <label for="month">월</label>
          <input id="month" type="number" min="1" max="12" placeholder="1-12" />
          <label for="day">일</label>
          <input id="day" type="number" min="1" max="31" placeholder="1-31" />
        </div>

        <div id="manual-fields" style="display:none">
          <label for="zodiac-select">별자리 선택</label>
          <select id="zodiac-select">
            ${ZODIAC_LIST.map((z) => `<option value="${z}">${zodiacNameKo(z)}</option>`).join('')}
          </select>
        </div>

        <button class="btn" type="submit">입장하기</button>
        <p class="error-text" id="join-error"></p>
      </form>
    </div>
  `

  const form = container.querySelector<HTMLFormElement>('#join-form')!
  const modeSelect = container.querySelector<HTMLSelectElement>('#zodiac-mode')!
  const birthdayFields = container.querySelector<HTMLElement>('#birthday-fields')!
  const manualFields = container.querySelector<HTMLElement>('#manual-fields')!
  const errorEl = container.querySelector<HTMLElement>('#join-error')!

  modeSelect.addEventListener('change', () => {
    const isBirthday = modeSelect.value === 'birthday'
    birthdayFields.style.display = isBirthday ? '' : 'none'
    manualFields.style.display = isBirthday ? 'none' : ''
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.textContent = ''
    const submitBtn = form.querySelector('button')!
    submitBtn.disabled = true

    try {
      const code = (container.querySelector<HTMLInputElement>('#code')!.value || '').trim().toUpperCase()
      const nickname = (container.querySelector<HTMLInputElement>('#nickname')!.value || '').trim()
      const pin = (container.querySelector<HTMLInputElement>('#pin')!.value || '').trim()

      if (code.length !== 6) throw new Error('학급 코드는 6자리예요.')
      if (!nickname) throw new Error('닉네임을 입력해 주세요.')
      if (!/^\d{4}$/.test(pin)) throw new Error('비밀번호는 숫자 4자리예요.')

      const classRoom = await getClass(code)
      if (!classRoom) throw new Error('존재하지 않는 학급 코드예요. 선생님께 확인해 주세요.')

      let zodiac: ZodiacSign | null = null
      if (modeSelect.value === 'birthday') {
        const month = Number(container.querySelector<HTMLInputElement>('#month')!.value)
        const day = Number(container.querySelector<HTMLInputElement>('#day')!.value)
        if (month && day) zodiac = zodiacFromBirthday(month, day)
      } else {
        zodiac = container.querySelector<HTMLSelectElement>('#zodiac-select')!.value as ZodiacSign
      }

      const { student } = await joinOrLogin(code, nickname, pin, zodiac)
      state.classRoom = classRoom
      state.student = student
      state.session = { classCode: code, studentId: student.id, nickname: student.nickname }
      saveSession(state.session)
      navigate('/star')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errorEl.textContent = msg === 'PIN_MISMATCH' ? '비밀번호가 일치하지 않아요. 선생님께 초기화를 요청하세요.' : msg
    } finally {
      submitBtn.disabled = false
    }
  })
}
