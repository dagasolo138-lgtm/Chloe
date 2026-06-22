import {
  deleteFromRecycleBin,
  getRecycledByTier,
  getRecycledCount,
  getRecycledMemories,
  purgeExpired,
  restoreMemory,
} from '../index.js';
import { LAYER_META } from './memoryList.js';

let recycleBinElement;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderRecycleItem(memory) {
  const layer = LAYER_META[memory.layer] ?? LAYER_META.identity;

  return `<article class="memory-recycle-item" data-memory-id="${memory.id}">
    <div class="memory-recycle-item__body">
      <p>${escapeHtml(memory.content)}</p>
      <div class="memory-item__meta">
        <span style="color:${layer.color}">${layer.icon} ${layer.label}</span>
        <span>修剪于 ${formatDateTime(memory.recycledAt)}</span>
      </div>
    </div>
    <div class="memory-recycle-item__actions">
      <button class="memory-secondary-btn" type="button" data-action="restore">恢复</button>
      <button class="memory-danger-btn" type="button" data-action="delete">永久删除</button>
    </div>
  </article>`;
}

function renderTier(title, memories) {
  return `<section class="memory-recycle-tier">
    <h3>${title}</h3>
    ${memories.length ? memories.map(renderRecycleItem).join('') : '<p class="memory-empty">暂无记忆。</p>'}
  </section>`;
}

async function renderRecycleBinContent() {
  await purgeExpired();
  const { tier1, tier2 } = await getRecycledByTier();
  const count = await getRecycledCount();

  recycleBinElement.innerHTML = `<section class="memory-panel memory-recycle-bin">
    <header class="memory-panel__nav">
      <button class="memory-nav-btn" type="button" data-action="back">← 返回记忆面板</button>
      <h2>回收桶</h2>
      <button class="memory-nav-btn" type="button" data-action="clear">🗑 清空全部</button>
    </header>
    <div class="memory-layer-content">
      ${renderTier('近期修剪（0-45天）', tier1)}
      ${renderTier('较早修剪（45-145天）', tier2)}
    </div>
    <footer class="memory-panel__statusbar">
      <span>回收桶共 ${count} 条</span>
      <span>超过145天自动删除</span>
    </footer>
  </section>`;

  recycleBinElement.querySelector('[data-action="back"]').addEventListener('click', unmountRecycleBin);
  recycleBinElement.querySelector('[data-action="clear"]').addEventListener('click', async () => {
    const confirmed = window.confirm('确认清空回收桶？此操作不可撤销');

    if (!confirmed) {
      return;
    }

    const allRecycled = await getRecycledMemories();
    await Promise.all(allRecycled.map((memory) => deleteFromRecycleBin(memory.id)));
    await renderRecycleBinContent();
  });

  recycleBinElement.querySelectorAll('.memory-recycle-item').forEach((item) => {
    item.addEventListener('click', async (event) => {
      const actionButton = event.target.closest('[data-action]');

      if (!actionButton) {
        return;
      }

      const memoryId = item.dataset.memoryId;

      if (actionButton.dataset.action === 'restore') {
        await restoreMemory(memoryId);
        window.alert('记忆已恢复，权重重置为 90');
        await renderRecycleBinContent();
        return;
      }

      const confirmed = window.confirm('确认永久删除这条记忆？此操作不可撤销');

      if (!confirmed) {
        return;
      }

      await deleteFromRecycleBin(memoryId);
      await renderRecycleBinContent();
    });
  });
}

export async function mountRecycleBin(container) {
  unmountRecycleBin();
  recycleBinElement = document.createElement('div');
  container.appendChild(recycleBinElement);
  await renderRecycleBinContent();
}

export function unmountRecycleBin() {
  recycleBinElement?.remove();
  recycleBinElement = undefined;
}
