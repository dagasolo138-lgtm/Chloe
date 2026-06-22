const LAYERS = ['identity', 'event', 'habit', 'project', 'knowledge'];

function getSize(canvas) {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function pickLayer(stageData, index) {
  const weighted = LAYERS.flatMap((layer) => Array.from({ length: Math.max(1, stageData.memoryCounts[layer] ?? 0) }, () => layer));
  return weighted[index % weighted.length] ?? LAYERS[index % LAYERS.length];
}

function createNode(canvas, stageData, index, count) {
  const { width, height } = getSize(canvas);
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  const layer = pickLayer(stageData, index);
  const layerCount = Math.max(1, stageData.memoryCounts[layer] ?? 1);

  return {
    layer,
    x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.22 * Math.random(),
    y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.22 * Math.random(),
    vx: 0,
    vy: 0,
    radius: Math.min(8, 3 + Math.sqrt(layerCount)),
    color: stageData.layerColors[layer],
  };
}

function createLinks(nodes) {
  const links = [];
  LAYERS.forEach((layer) => {
    const layerNodes = nodes.filter((node) => node.layer === layer);
    for (let i = 0; i < layerNodes.length - 1 && links.length < 150; i += 1) {
      links.push({ a: layerNodes[i], b: layerNodes[i + 1], color: layerNodes[i].color });
    }
  });
  return links;
}

function updateNodes(nodes, canvas, speed = 1) {
  const { width, height } = getSize(canvas);
  const centerX = width / 2;
  const centerY = height / 2;

  nodes.forEach((node, index) => {
    for (let i = index + 1; i < nodes.length; i += 1) {
      const other = nodes[i];
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distance = Math.max(18, Math.hypot(dx, dy));
      const force = 22 / (distance * distance);
      node.vx += (dx / distance) * force * speed;
      node.vy += (dy / distance) * force * speed;
      other.vx -= (dx / distance) * force * speed;
      other.vy -= (dy / distance) * force * speed;
    }

    node.vx += (centerX - node.x) * 0.0008 * speed + (Math.random() - 0.5) * 0.015 * speed;
    node.vy += (centerY - node.y) * 0.0008 * speed + (Math.random() - 0.5) * 0.015 * speed;
    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;
  });
}

function createSignals(links) {
  return Array.from({ length: Math.min(3, links.length) }, () => ({
    link: links[Math.floor(Math.random() * links.length)],
    progress: Math.random(),
    speed: 0.004 + Math.random() * 0.008,
  }));
}

export function createStage4(ctx, canvas, stageData) {
  const count = Math.min(Math.max(stageData.memoryCounts.total, 12), 80);
  const nodes = Array.from({ length: count }, (_, index) => createNode(canvas, stageData, index, count));
  const links = createLinks(nodes);
  const signals = createSignals(links);

  return {
    update() {
      const { width, height } = getSize(canvas);
      ctx.clearRect(0, 0, width, height);
      updateNodes(nodes, canvas);

      links.forEach((link) => {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = link.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(link.a.x, link.a.y);
        ctx.lineTo(link.b.x, link.b.y);
        ctx.stroke();
      });

      nodes.forEach((node) => {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      signals.forEach((signal) => {
        if (!signal.link) return;
        signal.progress += signal.speed;
        if (signal.progress > 1) {
          signal.link = links[Math.floor(Math.random() * links.length)];
          signal.progress = 0;
        }
        const x = signal.link.a.x + (signal.link.b.x - signal.link.a.x) * signal.progress;
        const y = signal.link.a.y + (signal.link.b.y - signal.link.a.y) * signal.progress;
        ctx.globalAlpha = 1;
        ctx.fillStyle = signal.link.color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
    },
    destroy() {},
  };
}
