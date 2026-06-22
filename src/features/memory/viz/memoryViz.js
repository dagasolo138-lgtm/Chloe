import { createStage0 } from './stage0_fog.js';
import { createStage1 } from './stage1_colorFog.js';
import { createStage2 } from './stage2_nebula.js';
import { createStage3 } from './stage3_galaxy.js';
import { createStage4 } from './stage4_neural.js';
import { createStage5 } from './stage5_pruned.js';

export const LAYER_COLORS = {
  identity: 'rgba(255,255,255,0.8)',
  event: 'rgba(96,165,250,0.8)',
  habit: 'rgba(74,222,128,0.8)',
  project: 'rgba(251,146,60,0.8)',
  knowledge: 'rgba(167,139,250,0.8)',
};

const STAGE_RENDERERS = [
  createStage0,
  createStage1,
  createStage2,
  createStage3,
  createStage4,
  createStage5,
];

function resizeCanvas(canvas, ctx, container) {
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function initMemoryViz(container, stageData) {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let animationFrameId;
  let destroyed = false;
  let renderer;

  canvas.className = 'memory-viz-canvas';
  container.appendChild(canvas);
  resizeCanvas(canvas, ctx, container);

  const normalizedStageData = {
    ...stageData,
    layerColors: LAYER_COLORS,
  };
  const rendererFactory = STAGE_RENDERERS[stageData.currentStage] ?? createStage0;
  renderer = rendererFactory(ctx, canvas, normalizedStageData);

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas(canvas, ctx, container);
  });
  resizeObserver.observe(container);

  const tick = () => {
    if (destroyed) {
      return;
    }

    renderer.update();
    animationFrameId = requestAnimationFrame(tick);
  };

  animationFrameId = requestAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.destroy();
      canvas.remove();
    },
  };
}
