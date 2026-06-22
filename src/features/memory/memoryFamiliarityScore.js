import { callApi } from '../../api/deepseek.js';
import { getAllMemories } from './memoryStore.js';

const LAYERS = ['identity', 'event', 'habit', 'project', 'knowledge'];
const MAX_LAYER_ITEMS = 80;

const FAMILIARITY_SYSTEM_PROMPT = `你是一个评估 AI 对用户熟悉程度的系统。
根据以下用户记忆，对 AI 的熟悉程度进行评分。
五个维度，每项满分20分：
1. 身份层完整度：记忆是否涵盖姓名/职业/技术栈/基本信息
2. 事件层深度：是否有重要生活事件而非只是琐事
3. 习惯层准确度：能否预判用户偏好和反应
4. 对话连贯性：用户是否体现出一致的思维风格
5. 情感理解度：能否理解用户的情绪模式
只输出 JSON：
{
  "identity": 0-20,
  "event": 0-20,
  "habit": 0-20,
  "coherence": 0-20,
  "emotion": 0-20,
  "total": 0-100,
  "reason": "一句话说明主要不足"
}`;

function groupMemoriesByLayer(memories) {
  return LAYERS.reduce((groups, layer) => {
    groups[layer] = memories.filter((memory) => memory.layer === layer);
    return groups;
  }, {});
}

function buildLayerSummary(layer, memories) {
  if (!memories.length) {
    return `【${layer}】\n- 无`;
  }

  const lines = memories
    .slice(0, MAX_LAYER_ITEMS)
    .map((memory) => `- ${memory.content}`);

  return `【${layer}】\n${lines.join('\n')}`;
}

function buildMemorySummary(memories) {
  const groups = groupMemoriesByLayer(memories);
  return LAYERS.map((layer) => buildLayerSummary(layer, groups[layer])).join('\n\n');
}

function parseScoreJson(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('Familiarity score response did not include JSON');
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function evaluate(apiKey) {
  try {
    const memories = await getAllMemories();
    const responseText = await callApi({
      systemPrompt: FAMILIARITY_SYSTEM_PROMPT,
      userPrompt: buildMemorySummary(memories),
      apiKey,
    });
    const score = parseScoreJson(responseText);
    const total = Number(score.total);

    if (!Number.isFinite(total)) {
      return 0;
    }

    return Math.min(100, Math.max(0, total));
  } catch (error) {
    return 0;
  }
}
