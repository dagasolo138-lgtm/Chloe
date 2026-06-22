function getSize(canvas) {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function randomGaussian() {
  let u = 0;
  let v = 0;

  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function createFogParticle(canvas) {
  const { width, height } = getSize(canvas);
  const spread = Math.min(width, height) * 0.16;

  return {
    x: width / 2 + randomGaussian() * spread,
    y: height / 2 + randomGaussian() * spread,
    vx: (Math.random() - 0.5) * 0.12,
    vy: (Math.random() - 0.5) * 0.12,
    opacity: 0.1 + Math.random() * 0.3,
    radius: 1 + Math.random() * 2,
  };
}

function drawGlow(ctx, canvas) {
  const { width, height } = getSize(canvas);
  const radius = Math.min(width, height) * 0.28;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.06)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function createStage0(ctx, canvas) {
  const particles = Array.from({ length: 80 }, () => createFogParticle(canvas));

  return {
    update() {
      const { width, height } = getSize(canvas);
      const centerX = width / 2;
      const centerY = height / 2;
      const maxDistance = Math.min(width, height) * 0.35;

      ctx.clearRect(0, 0, width, height);
      drawGlow(ctx, canvas);

      particles.forEach((particle) => {
        particle.vx += (Math.random() - 0.5) * 0.025;
        particle.vy += (Math.random() - 0.5) * 0.025;
        particle.vx *= 0.99;
        particle.vy *= 0.99;
        particle.x += particle.vx;
        particle.y += particle.vy;

        const dx = particle.x - centerX;
        const dy = particle.y - centerY;
        const distance = Math.hypot(dx, dy);

        if (distance > maxDistance) {
          particle.vx -= (dx / distance) * 0.2;
          particle.vy -= (dy / distance) * 0.2;
        }

        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
    },
    destroy() {},
  };
}
