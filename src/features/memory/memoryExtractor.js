import { callApi } from '../../api/deepseek.js';
import { canAddMemory, incrementTodayCount } from './memoryQuota.js';
import { saveMemory } from './memoryStore.js';
import { calculateProtectedUntil } from './memoryWeightEngine.js';

const MEMORY_TRIGGERS = ['记住', '记一下', '帮我记', '记下来', '别忘了', '记得', '存一下', '记住这个'];

const EXTRACT_SYSTEM_PROMPT = `你是一个记忆提炼助手。
从用户消息中提炼出值得记住的核心信息。
判断属于哪个记忆层：
  identity（身份：姓名/职业/技术栈/基本信息）
  event（事件：重要生活决策/情绪感受/发生的事）
  habit（习惯：行为模式/偏好/交互风格）
  project（项目：当前开发中的项目/阻塞点/进展）
  knowledge（知识：领域知识/技术知识）
判断重要程度，输出 initialWeight（60-90 之间的整数）。
只输出 JSON，格式：
{
  "layer": "identity|event|habit|project|knowledge",
  "content": "提炼后的记忆内容，简洁准确",
  "initialWeight": 80
}
不输出任何其他内容。`;

function parseMemoryJson(text) {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('{') ? trimmed : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
  return JSON.parse(jsonText);
}

export function detectMemoryTrigger(userMessage) {
  return MEMORY_TRIGGERS.some((trigger) => userMessage.includes(trigger));
}

export async function extractMemory(userMessage, apiKey) {
  const responseText = await callApi({
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    userPrompt: userMessage,
    apiKey,
  });
  const extracted = parseMemoryJson(responseText);

  if (!(await canAddMemory())) {
    return { error: 'QUOTA_EXCEEDED' };
  }

  const now = Date.now();
  const initialWeight = Math.min(90, Math.max(60, Number.parseInt(extracted.initialWeight, 10) || 80));
  const memory = {
    id: crypto.randomUUID(),
    layer: extracted.layer,
    content: extracted.content,
    summary: '',
    weight: initialWeight,
    initialWeight,
    isInitial: false,
    isUserRestored: false,
    protectedUntil: calculateProtectedUntil(now, 90),
    createdAt: now,
    updatedAt: now,
    lastReferencedAt: now,
    source: 'ai',
  };

  const savedMemory = await saveMemory(memory);
  await incrementTodayCount();
  return savedMemory;
}
