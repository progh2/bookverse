export function renderLanding(container: HTMLElement) {
  container.innerHTML = `
    <div class="view">
      <div class="landing-grid">
        <a class="choice-card" href="#/join">
          <h2>⭐ 학생으로 입장</h2>
          <p>학급 코드, 닉네임, 숫자 4자리 비밀번호로 내 별자리를 키워요.</p>
        </a>
        <a class="choice-card" href="#/teacher">
          <h2>🏫 교사로 입장</h2>
          <p>구글 계정으로 로그인해 학급 코드를 만들고 관리해요.</p>
        </a>
      </div>
    </div>
  `
}
