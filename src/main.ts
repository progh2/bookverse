import './style.css'
import { registerRoute, setOutlet } from './router'
import { renderLanding } from './views/LandingView'
import { renderAuth } from './views/AuthView'
import { renderClassPicker } from './views/ClassPickerView'
import { renderConstellation } from './views/ConstellationView'
import { renderClassNebula } from './views/ClassNebulaView'
import { renderBoard } from './views/BoardView'
import { renderTeacher } from './views/TeacherView'
import { renderRanking } from './views/RankingView'

const app = document.getElementById('app')!
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#/">⭐ Book두칠성</a>
    <nav>
      <a href="#/star">내 별자리</a>
      <a href="#/class">학급 성운</a>
      <a href="#/board">게시판</a>
      <a href="#/ranking">랭킹</a>
      <a href="#/teacher">교사</a>
    </nav>
  </header>
  <main id="outlet"></main>
`

registerRoute('/', (c) => renderLanding(c))
registerRoute('/auth', (c) => renderAuth(c))
registerRoute('/classes', (c) => renderClassPicker(c))
registerRoute('/star', (c) => renderConstellation(c))
registerRoute('/class', (c) => renderClassNebula(c))
registerRoute('/board', (c) => renderBoard(c))
registerRoute('/ranking', (c) => renderRanking(c))
registerRoute('/teacher', (c) => renderTeacher(c))

setOutlet(document.getElementById('outlet')!)
