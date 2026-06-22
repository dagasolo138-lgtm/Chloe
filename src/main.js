import './styles/app.css';
import './styles/onboarding.css';
import './styles/chat.css';
import './styles/memory-ui.css';
import { getApiKey } from './api/deepseek.js';
import { initDB } from './features/memory/index.js';
import { processExpiredMemories } from './features/memory/memoryCompressor.js';
import { checkPendingReminders } from './features/memory/memoryReminder.js';
import { runDailyDecay } from './features/memory/memoryWeightEngine.js';
import {
  isOnboardingCompleted,
  isOnboardingSkipped,
} from './features/onboarding/onboardingStore.js';
import { mountOnboarding } from './features/onboarding/onboardingView.js';
import { initChatView } from './features/chat/chatView.js';

const app = document.querySelector('#app');

async function startApp() {
  await initDB();

  const decayResults = await runDailyDecay();
  window.__pendingReminders = decayResults;

  const apiKey = getApiKey();
  if (apiKey) {
    await processExpiredMemories(apiKey);
  }

  let userName = '';

  if (!isOnboardingCompleted() && !isOnboardingSkipped()) {
    const result = await mountOnboarding(document.body);
    userName = result?.userName ?? '';
  }

  await initChatView(app, { userName });
}

startApp().catch((error) => {
  console.error('Failed to initialize Chloe:', error);
});
