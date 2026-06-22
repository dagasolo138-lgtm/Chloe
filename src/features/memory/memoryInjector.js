import { getAllMemories, updateMemory } from './memoryStore.js';

const PROJECT_INTENT_KEYWORDS = [
  '代码', '项目', '开发', 'bug', '功能', '部署',
  '实现', '架构', '接口', '数据库', '前端', '后端',
  'git', 'github', 'api', '组件', '模块', '调试',
];

function normalizeText(text) {
  return text.toLowerCase();
}

function formatMemory(memory) {
  const prefix = memory.isUserRestored ? '[用户亲自恢复的记忆，请知晓但不要主动提起] ' : '';
  return `- ${prefix}${memory.content}`;
}

function appendSection(sections, title, memories) {
  if (!memories.length) {
    return;
  }

  sections.push(`${title}\n${memories.map(formatMemory).join('\n')}`);
}

function extractKeywords(text) {
  const normalized = normalizeText(text);
  const asciiWords = normalized.match(/[a-z0-9_#+.-]+/g) ?? [];
  const cjkChars = normalized.match(/[\u4e00-\u9fff]/g) ?? [];
  return [...new Set([...asciiWords, ...cjkChars])];
}

export function detectProjectIntent(userMessage) {
  const normalized = normalizeText(userMessage);
  return PROJECT_INTENT_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
}

export function matchKnowledgeMemories(memories, userMessage) {
  const keywords = extractKeywords(userMessage);

  return memories
    .filter((memory) => memory.layer === 'knowledge')
    .map((memory) => {
      const content = normalizeText(memory.content);
      const score = keywords.reduce((total, keyword) => total + (content.includes(keyword) ? 1 : 0), 0);
      return { memory, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.memory.weight - a.memory.weight)
    .slice(0, 10)
    .map(({ memory }) => memory);
}

export async function updateLastReferenced(memories) {
  const now = Date.now();
  await Promise.all(memories.map((memory) => updateMemory(memory.id, { lastReferencedAt: now })));
}

export async function buildMemoryContext(userMessage) {
  const memories = await getAllMemories();
  const identityMemories = memories.filter((memory) => memory.layer === 'identity');
  const eventMemories = memories.filter((memory) => memory.layer === 'event');
  const habitMemories = memories.filter((memory) => memory.layer === 'habit');
  const projectMemories = detectProjectIntent(userMessage)
    ? memories.filter((memory) => memory.layer === 'project')
    : [];
  const knowledgeMemories = matchKnowledgeMemories(memories, userMessage);
  const injectedMemories = [
    ...identityMemories,
    ...eventMemories,
    ...habitMemories,
    ...projectMemories,
    ...knowledgeMemories,
  ];

  if (!injectedMemories.length) {
    return '';
  }

  const sections = [];
  appendSection(sections, '【身份】', identityMemories);
  appendSection(sections, '【重要事件】', eventMemories);
  appendSection(sections, '【习惯偏好】（低权重参考，了解即可）', habitMemories);
  appendSection(sections, '【当前项目】（仅在相关时参考）', projectMemories);
  appendSection(sections, '【知识】（仅在相关时参考）', knowledgeMemories);

  await updateLastReferenced(injectedMemories);

  return `===用户记忆===\n\n${sections.join('\n\n')}\n\n===记忆结束===`;
}
