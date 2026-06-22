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
  return {
    layer,
    x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.28,
    y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.22,
    vx: 0,
    vy: 0,
    radius: 4 + Math.random() * 4,
    weight: 0.25 + Math.random() * 0.75,
    color: stageData.layerColors[layer],
  };
}

function createLink(a, b) {
  const strength = (a.weight + b.weight) / 2;
  return { a, b, strength, opacity: strength < 0.3 ? 0.05 : 0.12 + strength * 0.34, pruning: false };
}

function createLinks(nodes) {
  const links = [];
  for (let i = 0; i < nodes.length - 1 && links.length < 150; i += 1) {
    links.push(createLink(nodes[i], nodes[(i + 1) % nodes.length]));
    if (i % 3 === 0 && links.length < 150) {
      links.push(createLink(nodes[i], nodes[(i + 5) % nodes.length]));
    }
  }
  return links;
}

function updateNodes(nodes, canvas) {
  const { width, height } = getSize(canvas);
  const centerX = width / 2;
  const centerY = height / 2;

  nodes.forEach((node) => {
    node.vx += (centerX - node.x) * 0.00035 + (Math.random() - 0.5) * 0.004;
    node.vy += (centerY - node.y) * 0.00035 + (Math.random() - 0.5) * 0.004;
    node.vx *= 0.92;
    node.vy *= 0.92;
    node.x += node.vx;
    node.y += node.vy;
  });
}

function addStrongLink(nodes, links) {
  const strongNodes = nodes.filter((node) => node.weight > 0.65);
  if (strongNodes.length < 2 || links.length >= 150) return;
  const a = strongNodes[Math.floor(Math.random() * strongNodes.length)];
  const b = strongNodes[Math.floor(Math.random() * strongNodes.length)];
  if (a !== b) links.push(createLink(a, b));
}

export function createStage5(ctx, canvas, stageData) {
  const count = Math.min(Math.max(stageData.memoryCounts.total, 20), 80);
  const nodes = Array.from({ length: count }, (_, index) => createNode(canvas, stageData, index, count));
  const links = createLinks(nodes);
  let lastPruneAt = performance.now();

  return {
    update() {
      const { width, height } = getSize(canvas);
      const now = performance.now();
      ctx.clearRect(0, 0, width, height);
      updateNodes(nodes, canvas);

      if (now - lastPruneAt > 5000 && links.length > 1) {
        const weakest = [...links].sort((a, b) => a.strength - b.strength)[0];
        weakest.pruning = true;
        lastPruneAt = now;
        addStrongLink(nodes, links);
      }

      for (let i = links.length - 1; i >= 0; i -= 1) {
        const link = links[i];
        if (link.pruning) link.opacity -= 0.006;
        if (link.opacity <= 0) {
          links.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0.02, link.opacity);
        ctx.strokeStyle = link.a.color;
        ctx.lineWidth = link.strength > 0.7 ? 2 + link.strength * 2 : 1;
        ctx.beginPath();
        ctx.moveTo(link.a.x, link.a.y);
        ctx.lineTo(link.b.x, link.b.y);
        ctx.stroke();
      }

      nodes.forEach((node) => {
        ctx.globalAlpha = 0.75 + node.weight * 0.25;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
    },
    destroy() {},
  };
}
