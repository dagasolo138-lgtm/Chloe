const LAYERS = ['identity', 'event', 'habit', 'project', 'knowledge'];

function getSize(canvas) {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function createParticle(canvas, color, colored = false) {
  const { width, height } = getSize(canvas);
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * Math.min(width, height) * (colored ? 0.34 : 0.22);

  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    opacity: colored ? 0.18 + Math.random() * 0.45 : 0.1 + Math.random() * 0.22,
    radius: colored ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
    color,
    colored,
  };
}

function getDominantLayer(memoryCounts) {
  return LAYERS.reduce((dominant, layer) => (
    (memoryCounts[layer] ?? 0) > (memoryCounts[dominant] ?? 0) ? layer : dominant
  ), 'identity');
}

function drawParticle(ctx, particle) {
  ctx.globalAlpha = particle.opacity;
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
}

export function createStage1(ctx, canvas, stageData) {
  const baseParticles = Array.from({ length: 50 }, () => createParticle(canvas, 'rgba(255,255,255,0.8)'));
  const colorParticles = LAYERS.flatMap((layer) => Array.from(
    { length: Math.min((stageData.memoryCounts[layer] ?? 0) * 2, 30) },
    () => createParticle(canvas, stageData.layerColors[layer], true),
  ));

  return {
    update() {
      const { width, height } = getSize(canvas);
      const centerX = width / 2;
      const centerY = height / 2;
      const dominantLayer = getDominantLayer(stageData.memoryCounts);
      const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.min(width, height) * 0.33);

      ctx.clearRect(0, 0, width, height);
      glow.addColorStop(0, stageData.layerColors[dominantLayer]);
      glow.addColorStop(0.45, 'rgba(255,255,255,0.07)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      [...baseParticles, ...colorParticles].forEach((particle) => {
        const dx = particle.x - centerX;
        const dy = particle.y - centerY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const maxDistance = Math.min(width, height) * (particle.colored ? 0.42 : 0.28);

        particle.vx += (Math.random() - 0.5) * 0.025 - (dx / distance) * 0.004;
        particle.vy += (Math.random() - 0.5) * 0.025 - (dy / distance) * 0.004;
        particle.vx *= 0.992;
        particle.vy *= 0.992;
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (distance > maxDistance) {
          particle.vx -= (dx / distance) * 0.12;
          particle.vy -= (dy / distance) * 0.12;
        }

        drawParticle(ctx, particle);
      });

      ctx.globalAlpha = 1;
    },
    destroy() {},
  };
}
