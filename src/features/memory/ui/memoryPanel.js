import {
  DAILY_LIMIT,
  canAddMemory,
  calculateProtectedUntil,
  getAllMemories,
  getCurrentStage,
  getTodayCount,
  getTotalCheckins,
  incrementTodayCount,
  saveMemory,
  STAGES,
} from '../index.js';
import { renderMemoryList, LAYER_META } from './memoryList.js';
import { mountRecycleBin } from './memoryRecycleBin.js';
import { initMemoryViz } from '../viz/memoryViz.js';

const LAYERS = ['identity', 'event', 'habit', 'project', 'knowledge'];
let panelElement;
let activeLayer = null;
let vizController;

function createUserMemory(layer, content) {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    layer,
    content,
    summary: '',
    weight: 80,
    initialWeight: 80,
    isInitial: false,
    isUserRestored: false,
    protectedUntil: calculateProtectedUntil(now, 90),
    createdAt: now,
    updatedAt: now,
    lastReferencedAt: now,
    source: 'user',
  };
}

function renderLayerButtons() {
  return LAYERS.map((layer) => {
    const meta = LAYER_META[layer];
    return `<button class="memory-layer-btn${activeLayer === layer ? ' active' : ''}" type="button" data-layer="${layer}">
      ${meta.icon} ${meta.label}
    </button>`;
  }).join('');
}

async function renderStatusBar() {
  const [memories, todayCount, totalCheckins] = await Promise.all([
    getAllMemories(),
    getTodayCount(),
    getTotalCheckins(),
  ]);

  const statusBar = panelElement.querySelector('.memory-panel__statusbar');
  statusBar.innerHTML = `
    <span>${memories.length} / 500</span>
    <span>今日已用配额 ${todayCount} / ${DAILY_LIMIT}</span>
    <span>使用天数 ${totalCheckins} 天</span>
  `;
}

async function renderLayerContent() {
  const content = panelElement.querySelector('.memory-layer-content');

  if (!activeLayer) {
    content.innerHTML = '<p class="memory-empty">选择一个记忆层查看或新建记忆。</p>';
    return;
  }

  content.innerHTML = '<div class="memory-list-container"></div><button class="memory-create-btn" type="button">+ 新建记忆</button>';
  const listContainer = content.querySelector('.memory-list-container');
  await renderMemoryList(listContainer, activeLayer);

  content.querySelector('.memory-create-btn').addEventListener('click', async () => {
    if (!(await canAddMemory())) {
      window.alert('今日配额已用完');
      return;
    }

    const text = window.prompt('请输入新的记忆内容')?.trim();

    if (!text) {
      return;
    }

    await saveMemory(createUserMemory(activeLayer, text));
    await incrementTodayCount();
    await renderLayerContent();
    await renderStatusBar();
  });
}

function getMemoryCounts(memories) {
  return {
    identity: memories.filter((memory) => memory.layer === 'identity').length,
    event: memories.filter((memory) => memory.layer === 'event').length,
    habit: memories.filter((memory) => memory.layer === 'habit').length,
    project: memories.filter((memory) => memory.layer === 'project').length,
    knowledge: memories.filter((memory) => memory.layer === 'knowledge').length,
    total: memories.length,
  };
}

async function renderPanelContent() {
  const [currentStage, memories] = await Promise.all([getCurrentStage(), getAllMemories()]);
  const stage = STAGES[currentStage] ?? STAGES[0];

  panelElement.innerHTML = `<section class="memory-panel">
    <header class="memory-panel__nav">
      <button class="memory-nav-btn" type="button" data-action="close">← 返回</button>
      <h2>记忆系统</h2>
      <div class="memory-panel__actions">
        <button class="memory-nav-btn" type="button" data-action="all">📋</button>
        <button class="memory-nav-btn" type="button" data-action="recycle">🗑</button>
      </div>
    </header>
    <main class="memory-panel__main">
      <div id="memory-viz-container"></div>
      <p class="memory-stage-label">阶段${currentStage} · ${stage.name}</p>
      <div class="memory-layers">${renderLayerButtons()}</div>
      <section class="memory-layer-content"></section>
    </main>
    <footer class="memory-panel__statusbar"></footer>
  </section>`;

  vizController?.destroy();
  vizController = initMemoryViz(panelElement.querySelector('#memory-viz-container'), {
    currentStage,
    memoryCounts: getMemoryCounts(memories),
  });

  panelElement.querySelector('[data-action="close"]').addEventListener('click', unmountMemoryPanel);
  panelElement.querySelector('[data-action="all"]').addEventListener('click', async () => {
    activeLayer = activeLayer === 'all' ? null : 'all';
    const content = panelElement.querySelector('.memory-layer-content');
    content.innerHTML = '<div class="memory-list-container"></div>';
    await renderMemoryList(content.querySelector('.memory-list-container'), 'all');
    panelElement.querySelectorAll('.memory-layer-btn').forEach((button) => button.classList.remove('active'));
  });
  panelElement.querySelector('[data-action="recycle"]').addEventListener('click', () => {
    mountRecycleBin(document.body);
  });

  panelElement.querySelectorAll('.memory-layer-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      activeLayer = activeLayer === button.dataset.layer ? null : button.dataset.layer;
      panelElement.querySelectorAll('.memory-layer-btn').forEach((item) => {
        item.classList.toggle('active', item.dataset.layer === activeLayer);
      });
      await renderLayerContent();
    });
  });

  await renderLayerContent();
  await renderStatusBar();
}

export async function mountMemoryPanel(container) {
  unmountMemoryPanel();
  activeLayer = null;
  panelElement = document.createElement('div');
  container.appendChild(panelElement);
  await renderPanelContent();
}

export function unmountMemoryPanel() {
  vizController?.destroy();
  vizController = undefined;
  panelElement?.remove();
  panelElement = undefined;
}
