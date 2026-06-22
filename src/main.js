import './styles/app.css';
import { initDB } from './features/memory/index.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell">
    <section class="hero-card" aria-labelledby="app-title">
      <h1 id="app-title">Chloe</h1>
      <p>一位会记得、会遗忘、也会重新想起你的 AI 伴侣。记忆系统已准备初始化。</p>
    </section>
  </main>
`;

initDB().catch((error) => {
  console.error('Failed to initialize Chloe memory database:', error);
});
