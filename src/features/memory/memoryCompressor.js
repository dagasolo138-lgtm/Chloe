import { callApi } from '../../api/deepseek.js';
import { getAllMemories, moveToRecycleBin, saveMemory } from './memoryStore.js';
import { INIT_PROTECTION } from './memoryWeightEngine.js';

const COMPRESS_SYSTEM_PROMPT = `将以下记忆压缩成不超过20个字的摘要，
只保留最核心的事实，不加任何解释。
只输出压缩后的文字，不输出其他内容。`;

export async function compressMemory(memory, apiKey) {
  const compressedText = await callApi({
    systemPrompt: COMPRESS_SYSTEM_PROMPT,
    userPrompt: memory.content,
    apiKey,
  });

  return compressedText.trim().slice(0, 20);
}

export async function processExpiredMemories(apiKey) {
  const memories = await getAllMemories();
  const expiredMemories = memories.filter((memory) => memory.weight <= 10);

  await Promise.all(expiredMemories.map(async (memory) => {
    const compressedText = await compressMemory(memory, apiKey);
    const now = Date.now();

    await saveMemory({
      id: crypto.randomUUID(),
      layer: 'identity',
      content: `[长期记忆] ${compressedText}`,
      summary: '',
      weight: memory.initialWeight ?? memory.weight,
      initialWeight: memory.initialWeight ?? memory.weight,
      isInitial: true,
      isUserRestored: false,
      protectedUntil: INIT_PROTECTION,
      createdAt: now,
      updatedAt: now,
      lastReferencedAt: now,
      source: 'ai',
    });
    await moveToRecycleBin(memory);
  }));

  return expiredMemories.length;
}
