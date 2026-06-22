import { getApiKey } from '../../api/deepseek.js';
import { getAllMemories, updateMemory } from './memoryStore.js';
import { processExpiredMemories } from './memoryCompressor.js';
import { calculateProtectedUntil, WARNING_THRESHOLD } from './memoryWeightEngine.js';

const IMPORTANT_KEYWORDS = [
  '重要', '记得', '别忘了', '有用', '保留',
  '当然', '是的', '对', '需要',
];

const UNIMPORTANT_KEYWORDS = [
  '不重要', '忘了吧', '删了', '无所谓',
  '不需要', '没用', '算了',
];

export async function checkPendingReminders() {
  const memories = await getAllMemories();
  return memories
    .filter((memory) => memory.weight <= WARNING_THRESHOLD && !memory.reminderSentAt)
    .slice(0, 1);
}

export async function markReminderSent(memoryId) {
  return updateMemory(memoryId, { reminderSentAt: Date.now() });
}

export function buildReminderMessage(memory) {
  const contentPreview = memory.content.slice(0, 15);
  return `还记得「${contentPreview}」吗？\n 我似乎要忘记这个了，\n 它对你来说还重要吗？`;
}

export function detectUserResponse(userMessage) {
  if (UNIMPORTANT_KEYWORDS.some((keyword) => userMessage.includes(keyword))) {
    return 'unimportant';
  }

  if (IMPORTANT_KEYWORDS.some((keyword) => userMessage.includes(keyword))) {
    return 'important';
  }

  return 'unclear';
}

export async function handleReminderResponse(memoryId, responseType, apiKey = getApiKey()) {
  if (responseType === 'important') {
    const now = Date.now();
    const memory = await updateMemory(memoryId, {
      weight: 90,
      protectedUntil: calculateProtectedUntil(now, 90),
      updatedAt: now,
    });

    return { action: 'restored', memory };
  }

  if (responseType === 'unimportant') {
    await processExpiredMemories(apiKey);
    return { action: 'recycled' };
  }

  return { action: 'pending' };
}
