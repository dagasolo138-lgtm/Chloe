import {
  getAllMemories,
  getMemoriesByLayer,
  moveToRecycleBin,
} from '../index.js';

export const LAYER_META = {
  identity: { label: '身份', icon: '⚪', color: 'rgba(255,255,255,0.85)' },
  event: { label: '事件', icon: '🔵', color: '#3b82f6' },
  habit: { label: '习惯', icon: '🟢', color: '#22c55e' },
  project: { label: '项目', icon: '🟠', color: '#f97316' },
  knowledge: { label: '知识', icon: '🟣', color: '#a855f7' },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getWeightClass(weight) {
  if (weight <= 10) {
    return 'memory-item__weight--danger';
  }

  if (weight <= 30) {
    return 'memory-item__weight--warning';
  }

  return '';
}

function renderMemoryItem(memory) {
  const layer = LAYER_META[memory.layer] ?? LAYER_META.identity;
  const weightClass = getWeightClass(memory.weight);

  return `<article class="memory-item" data-memory-id="${memory.id}">
    <span class="memory-item__dot" style="background:${layer.color}"></span>
    <div class="memory-item__body">
      <button class="memory-item__content" type="button">${escapeHtml(memory.content)}</button>
      <div class="memory-item__meta">
        <span>${formatDate(memory.createdAt)}</span>
        <span class="${weightClass}">权重 ${memory.weight}</span>
        ${memory.weight <= 10 ? '<span class="memory-item__weight--danger">即将遗忘</span>' : ''}
        ${memory.isUserRestored ? '<span class="memory-item__tag">亲自恢复</span>' : ''}
        <span>${layer.icon} ${layer.label}</span>
      </div>
    </div>
    <button class="memory-item__delete" type="button" aria-label="删除记忆">🗑</button>
  </article>`;
}

async function getLayerMemories(layer) {
  if (layer === 'all') {
    return getAllMemories();
  }

  return getMemoriesByLayer(layer);
}

export async function renderMemoryList(container, layer) {
  const memories = (await getLayerMemories(layer)).sort((a, b) => b.createdAt - a.createdAt);

  if (!memories.length) {
    container.innerHTML = '<p class="memory-empty">这一层还没有记忆。</p>';
    return;
  }

  container.innerHTML = memories.map(renderMemoryItem).join('');

  container.querySelectorAll('.memory-item__content').forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.toggle('expanded');
    });
  });

  container.querySelectorAll('.memory-item__delete').forEach((button) => {
    button.addEventListener('click', async () => {
      const item = button.closest('.memory-item');
      const memory = memories.find((entry) => entry.id === item.dataset.memoryId);

      if (!memory) {
        return;
      }

      const confirmed = window.confirm('确认删除这条记忆？此操作不可撤销（记忆将进入回收桶）');

      if (!confirmed) {
        return;
      }

      await moveToRecycleBin(memory);
      await renderMemoryList(container, layer);
    });
  });
}
