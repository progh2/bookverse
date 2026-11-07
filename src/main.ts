import './style.css'
import { registerRoute, setOutlet } from './router'
import { renderLanding } from './views/LandingView'
import { renderJoin } from './views/JoinView'
import { renderConstellation } from './views/ConstellationView'
import { renderClassNebula } from './views/ClassNebulaView'
import { renderTeacher } from './views/TeacherView'

const app = document.getElementById('app')!
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#/">⭐ 밑줄 별자리</a>
    <nav>
      <a href="#/star">내 별자리</a>
      <a href="#/class">학급 성운</a>
      <a href="#/teacher">교사</a>
    </nav>
  </header>
  <main id="outlet"></main>
`

registerRoute('/', (c) => renderLanding(c))
registerRoute('/join', (c) => renderJoin(c))
registerRoute('/star', (c) => renderConstellation(c))
registerRoute('/class', (c) => renderClassNebula(c))
registerRoute('/teacher', (c) => renderTeacher(c))

setOutlet(document.getElementById('outlet')!)
