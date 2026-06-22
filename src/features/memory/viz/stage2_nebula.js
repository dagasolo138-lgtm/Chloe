const LAYERS = ['identity', 'event', 'habit', 'project', 'knowledge'];

function getSize(canvas) {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function createParticle(stageData, index) {
  const layer = LAYERS[index % LAYERS.length];
  return {
    layer,
    angle: Math.random() * Math.PI * 2,
    distance: 60 + Math.random() * 120,
    speed: (0.001 + Math.random() * 0.004) * (index % 2 ? 1 : -1),
    ellipse: 0.65 + Math.random() * 0.55,
    radius: 0.8 + Math.random() * 2.2,
    opacity: 0.25 + Math.random() * 0.55,
    color: stageData.layerColors[layer],
  };
}

export function createStage2(ctx, canvas, stageData) {
  const particles = Array.from({ length: 120 }, (_, index) => createParticle(stageData, index));
  let time = 0;

  return {
    update() {
      const { width, height } = getSize(canvas);
      const centerX = width / 2;
      const centerY = height / 2;
      const pulseRadius = 40 + Math.sin(time * 0.035) * 7.5 + 7.5;

      ctx.fillStyle = 'rgba(10,10,10,0.05)';
      ctx.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.angle += particle.speed;
        const wobble = Math.sin(time * 0.01 + particle.distance) * 8;
        const x = centerX + Math.cos(particle.angle) * (particle.distance + wobble);
        const y = centerY + Math.sin(particle.angle) * (particle.distance * particle.ellipse + wobble);

        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 3; i >= 1; i -= 1) {
        ctx.save();
        ctx.shadowBlur = 28 * i;
        ctx.shadowColor = 'rgba(255,255,255,0.35)';
        ctx.globalAlpha = 0.12 * i;
        ctx.fillStyle = i === 1 ? '#fff' : stageData.layerColors[LAYERS[i % LAYERS.length]];
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius / i, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      time += 1;
    },
    destroy() {},
  };
}
