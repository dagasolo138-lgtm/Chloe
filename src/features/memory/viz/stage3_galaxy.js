const LAYERS = ['identity', 'event', 'habit', 'project', 'knowledge'];

function getSize(canvas) {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function createBackgroundStar(canvas) {
  const { width, height } = getSize(canvas);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.2,
    opacity: 0.08 + Math.random() * 0.22,
  };
}

function createArmStars(stageData, layer, armIndex) {
  const count = Math.min((stageData.memoryCounts[layer] ?? 0) * 3, 60);
  const starCount = Math.max(8, count);
  return Array.from({ length: starCount }, (_, index) => ({
    layer,
    baseAngle: (armIndex * Math.PI * 2) / LAYERS.length,
    t: index / Math.max(1, starCount),
    jitter: (Math.random() - 0.5) * 0.38,
    radius: 0.8 + Math.random() * 2.2,
    opacity: 0.25 + Math.random() * 0.65,
  }));
}

export function createStage3(ctx, canvas, stageData) {
  const backgroundStars = Array.from({ length: 200 }, () => createBackgroundStar(canvas));
  const armStars = LAYERS.flatMap((layer, index) => createArmStars(stageData, layer, index));
  let rotation = 0;

  return {
    update() {
      const { width, height } = getSize(canvas);
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.42;

      ctx.clearRect(0, 0, width, height);
      backgroundStars.forEach((star) => {
        ctx.globalAlpha = star.opacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      armStars.forEach((star) => {
        const spiral = star.t * 3.8;
        const radius = 28 + star.t * maxRadius;
        const angle = star.baseAngle + spiral + rotation + star.jitter;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius * 0.72;

        ctx.globalAlpha = star.opacity;
        ctx.fillStyle = stageData.layerColors[star.layer];
        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.shadowBlur = 35;
      ctx.shadowColor = '#fff';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = 1;
      rotation += 0.001;
    },
    destroy() {},
  };
}
