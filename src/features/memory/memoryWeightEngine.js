import { getAllMemories, updateMemory } from './memoryStore.js';

export const INITIAL_WEIGHT = 80;
export const INIT_WEIGHT = 90;
export const RESTORED_WEIGHT = 90;
export const PROTECTION_DAYS = 90;
export const RESTORED_PROTECTION_DAYS = 90;
export const DECAY_PER_DAY = 1;
export const WARNING_THRESHOLD = 10;
export const MIN_WEIGHT = 10;
export const INIT_PROTECTION = Infinity;

const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateProtectedUntil(createdAt, days) {
  if (days === Infinity) {
    return Infinity;
  }

  return createdAt + days * DAY_MS;
}

export function shouldDecay(memory) {
  if (memory.isInitial) {
    return false;
  }

  if (Date.now() < memory.protectedUntil) {
    return false;
  }

  return true;
}

export function decayWeight(memory) {
  if (!shouldDecay(memory)) {
    return memory;
  }

  return {
    ...memory,
    weight: Math.max(MIN_WEIGHT, memory.weight - DECAY_PER_DAY),
    updatedAt: Date.now(),
  };
}

export function needsWarning(memory) {
  return memory.weight <= WARNING_THRESHOLD && !memory.hasWarningTriggered;
}

export async function runDailyDecay() {
  const memories = await getAllMemories();
  const warningMemories = [];

  await Promise.all(
    memories.map(async (memory) => {
      const decayedMemory = decayWeight(memory);

      if (decayedMemory !== memory) {
        await updateMemory(memory.id, decayedMemory);
      }

      if (needsWarning(decayedMemory)) {
        warningMemories.push(decayedMemory);
      }
    }),
  );

  return warningMemories;
}
