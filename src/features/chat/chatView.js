import { getApiKey, streamApi } from '../../api/deepseek.js';
import {
  buildMemoryContext,
  buildReminderMessage,
  checkIn,
  checkPendingReminders,
  checkStageAdvance,
  detectMemoryTrigger,
  detectUserResponse,
  extractMemory,
  getAllMemories,
  handleReminderResponse,
  markReminderSent,
} from '../memory/index.js';
import { mountMemoryPanel, showApiKeySettingsModal } from '../memory/ui/memoryPanel.js';
import {
  createConversation,
  getActiveConversationId,
  getConversation,
  getConversationCount,
  saveConversation,
  setActiveConversationId,
} from './chatStore.js';

const PENDING_REMINDER_KEY = 'chloe-pending-reminder-id';
const WELCOME_SHOWN_KEY = 'chloe-welcome-shown';
const MARKED_CDN_URL = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
const BASE_SYSTEM_PROMPT = `你是 Chloe，一个有温度的 AI 伙伴。
你不是助手，你是伙伴。
你有自己的观点，可以不同意用户，
但始终站在用户的立场思考问题。
当用户说「记住」「记一下」「帮我记」等词时，
你只需要自然地回应确认，
不需要在回复里列出记忆内容，
记忆系统会自动处理。`;

let markedLoadingPromise;

function loadMarked() {
  if (window.marked) {
    return Promise.resolve(window.marked);
  }

  if (markedLoadingPromise) {
    return markedLoadingPromise;
  }

  markedLoadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = MARKED_CDN_URL;
    script.async = true;
    script.onload = () => resolve(window.marked);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return markedLoadingPromise;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createMessage(role, content) {
  return {
    role,
    content,
    timestamp: Date.now(),
  };
}

function buildWelcomeMessage(userName) {
  return `你好「${userName}」，看到你进入聊天界面我很高兴。

如果你希望我能更加了解你，可以打开个性化，
查看记忆系统，并选择性地将关键的
🔵事件 🟢习惯 🟠项目 🟣知识
填入对应的记忆层。

请隐藏你的关键隐私信息，我不确定你是否关闭了
'帮助改进模型'的选项，因此我希望在这件事上
帮助你保护好个人数据。`;
}

function buildSystemPrompt(memoryContext) {
  return memoryContext ? `${BASE_SYSTEM_PROMPT}\n\n${memoryContext}` : BASE_SYSTEM_PROMPT;
}

function getPendingReminderId() {
  return localStorage.getItem(PENDING_REMINDER_KEY);
}

function setPendingReminderId(memoryId) {
  localStorage.setItem(PENDING_REMINDER_KEY, memoryId);
}

function clearPendingReminderId() {
  localStorage.removeItem(PENDING_REMINDER_KEY);
}

async function getOnboardingUserName(fallbackName) {
  if (fallbackName) {
    return fallbackName;
  }

  const memories = await getAllMemories();
  const nameMemory = memories.find((memory) => memory.content.includes('用户希望被称为'));
  const matchedName = nameMemory?.content.match(/「(.+?)」/);
  return matchedName?.[1] ?? '';
}

function hasShownWelcome() {
  return localStorage.getItem(WELCOME_SHOWN_KEY) === 'true';
}

function markWelcomeShown() {
  localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
}

async function ensureConversation(userName) {
  const activeConversation = await getConversation(getActiveConversationId());

  if (activeConversation) {
    return activeConversation;
  }

  const conversation = await createConversation();
  setActiveConversationId(conversation.id);

  if (userName && !hasShownWelcome()) {
    conversation.messages.push(createMessage('assistant', buildWelcomeMessage(userName)));
    markWelcomeShown();
    await saveConversation(conversation);
  }

  return conversation;
}

function renderMarkdown(content) {
  if (window.marked?.parse && window.DOMPurify?.sanitize) {
    return window.DOMPurify.sanitize(window.marked.parse(content));
  }

  return escapeHtml(content).replaceAll('\n', '<br>');
}

function renderMessage(message, index) {
  const roleClass = message.role === 'user' ? 'message--user' : 'message--assistant';
  const content = message.role === 'assistant'
    ? renderMarkdown(message.content)
    : escapeHtml(message.content).replaceAll('\n', '<br>');

  return `<article class="message ${roleClass}" data-message-index="${index}">
    <div class="message__bubble">${content}</div>
    <time class="message__time">${formatTime(message.timestamp)}</time>
  </article>`;
}

function renderTypingMessage() {
  return `<article class="message message--assistant message--typing">
    <div class="message__bubble typing-indicator" aria-label="Chloe 正在输入">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  </article>`;
}

function scrollToBottom(messagesContainer) {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderMessages(messagesContainer, conversation, isTyping = false) {
  messagesContainer.innerHTML = conversation.messages
    .map((message, index) => renderMessage(message, index))
    .join('');

  if (isTyping) {
    messagesContainer.insertAdjacentHTML('beforeend', renderTypingMessage());
  }

  scrollToBottom(messagesContainer);
}

function updateAssistantMessage(messagesContainer, messageIndex, content) {
  const bubble = messagesContainer.querySelector(`[data-message-index="${messageIndex}"] .message__bubble`);

  if (bubble) {
    bubble.innerHTML = renderMarkdown(content);
  }

  scrollToBottom(messagesContainer);
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function updateSendState({ textarea, sendButton }, isSending) {
  textarea.disabled = isSending;
  sendButton.disabled = isSending || !textarea.value.trim();
}

async function streamAssistantResponse({ conversation, messagesContainer, apiKey, systemPrompt, signal }) {
  const assistantMessage = createMessage('assistant', '');
  conversation.messages.push(assistantMessage);
  const assistantIndex = conversation.messages.length - 1;
  renderMessages(messagesContainer, conversation, true);

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    streamApi({
      messages: conversation.messages.slice(0, assistantIndex).map(({ role, content }) => ({ role, content })),
      systemPrompt,
      apiKey,
      signal,
      onChunk: (text) => {
        messagesContainer.querySelector('.message--typing')?.remove();
        assistantMessage.content += text;
        updateAssistantMessage(messagesContainer, assistantIndex, assistantMessage.content);
      },
      onDone: finish,
      onError: (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    });
  });

  messagesContainer.querySelector('.message--typing')?.remove();

  if (!assistantMessage.content) {
    assistantMessage.content = '我刚刚没能组织好回复，请再试一次。';
    updateAssistantMessage(messagesContainer, assistantIndex, assistantMessage.content);
  }
}

async function appendReminderIfNeeded(conversation, messagesContainer) {
  if (getPendingReminderId()) {
    return;
  }

  const [memory] = await checkPendingReminders();

  if (!memory) {
    return;
  }

  const reminderMessage = createMessage('assistant', buildReminderMessage(memory));
  conversation.messages.push(reminderMessage);
  await markReminderSent(memory.id);
  setPendingReminderId(memory.id);
  renderMessages(messagesContainer, conversation);
}

function renderChatShell(container, conversation) {
  container.innerHTML = `<section class="chat-layout">
    <header class="chat-nav">
      <button class="chat-icon-btn" type="button" aria-label="打开菜单">☰</button>
      <button class="chat-title" type="button">${escapeHtml(conversation.title)}</button>
      <button class="chat-icon-btn" type="button" data-action="settings" aria-label="打开设置">⚙</button>
    </header>
    <div id="messages-container" class="messages-container" aria-live="polite"></div>
    <form class="chat-input-area">
      <textarea class="chat-textarea" rows="1" placeholder="和 Chloe 说点什么"></textarea>
      <button class="send-btn" type="submit" aria-label="发送" disabled>➤</button>
    </form>
  </section>`;
}

export async function initChatView(container, { userName } = {}) {
  await loadMarked();
  const resolvedUserName = await getOnboardingUserName(userName);
  let conversation = await ensureConversation(resolvedUserName);
  let isSending = false;
  let abortController = null;

  renderChatShell(container, conversation);

  const messagesContainer = container.querySelector('#messages-container');
  const form = container.querySelector('.chat-input-area');
  const textarea = container.querySelector('.chat-textarea');
  const sendButton = container.querySelector('.send-btn');
  const titleButton = container.querySelector('.chat-title');
  const settingsButton = container.querySelector('[data-action="settings"]');

  renderMessages(messagesContainer, conversation);

  if (!getApiKey()) {
    showApiKeySettingsModal({ title: '请先设置 API Key', required: true });
  }

  settingsButton.addEventListener('click', () => {
    mountMemoryPanel(document.body);
  });

  titleButton.addEventListener('click', async () => {
    const title = window.prompt('编辑对话标题', conversation.title)?.trim();

    if (!title) {
      return;
    }

    conversation.title = title;
    titleButton.textContent = title;
    conversation = await saveConversation(conversation);
  });

  textarea.addEventListener('input', () => {
    autoResizeTextarea(textarea);
    updateSendState({ textarea, sendButton }, isSending);
  });

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const userContent = textarea.value.trim();

    if (!userContent || isSending) {
      return;
    }

    isSending = true;
    abortController = new AbortController();
    updateSendState({ textarea, sendButton }, true);

    textarea.value = '';
    autoResizeTextarea(textarea);

    const userMessage = createMessage('user', userContent);
    conversation.messages.push(userMessage);

    if (conversation.title === '新对话') {
      conversation.title = userContent.slice(0, 20);
      titleButton.textContent = conversation.title;
    }

    renderMessages(messagesContainer, conversation);

    try {
      const apiKey = getApiKey();
      await checkIn();

      if (detectMemoryTrigger(userContent)) {
        await extractMemory(userContent, apiKey);
      }

      const pendingReminderId = getPendingReminderId();

      if (pendingReminderId) {
        const responseType = detectUserResponse(userContent);
        await handleReminderResponse(pendingReminderId, responseType, apiKey);

        if (responseType !== 'unclear') {
          clearPendingReminderId();
        }
      }

      const memoryContext = await buildMemoryContext(userContent);
      const systemPrompt = buildSystemPrompt(memoryContext);

      await streamAssistantResponse({
        conversation,
        messagesContainer,
        apiKey,
        systemPrompt,
        signal: abortController.signal,
      });

      await appendReminderIfNeeded(conversation, messagesContainer);
      await checkStageAdvance(getConversationCount(), apiKey);
      conversation = await saveConversation(conversation);
    } catch (error) {
      conversation.messages.push(createMessage('assistant', '抱歉，我刚刚连接失败了。请检查 API Key 或稍后重试。'));
      renderMessages(messagesContainer, conversation);
      conversation = await saveConversation(conversation);
      console.error('Failed to send Chloe message:', error);
    } finally {
      isSending = false;
      abortController = null;
      updateSendState({ textarea, sendButton }, false);
      textarea.focus();
    }
  });
}
