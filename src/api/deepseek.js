export const BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_MODEL = 'deepseek-v4-flash';

export function getApiKey() {
  return localStorage.getItem('chloe-api-key');
}

export function setApiKey(key) {
  localStorage.setItem('chloe-api-key', key);
}

function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function buildMessages(systemPrompt, userPrompt) {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

export async function callApi({ systemPrompt, userPrompt, apiKey }) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: buildMessages(systemPrompt, userPrompt),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    throw new Error('DeepSeek API response did not include message content');
  }

  return content;
}

function parseStreamLine(line) {
  if (!line.startsWith('data:')) {
    return null;
  }

  return line.slice(5).trim();
}

export async function streamApi({
  messages,
  systemPrompt,
  apiKey,
  onChunk,
  onDone,
  onError,
  signal,
}) {
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneCalled = false;

    const finish = () => {
      if (!doneCalled) {
        doneCalled = true;
        onDone?.();
      }
    };

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      lines.forEach((line) => {
        const payload = parseStreamLine(line.trim());

        if (!payload) {
          return;
        }

        if (payload === '[DONE]') {
          finish();
          return;
        }

        const data = JSON.parse(payload);
        const text = data?.choices?.[0]?.delta?.content;

        if (text) {
          onChunk?.(text);
        }
      });
    }

    if (buffer.trim()) {
      const payload = parseStreamLine(buffer.trim());

      if (payload && payload !== '[DONE]') {
        const data = JSON.parse(payload);
        const text = data?.choices?.[0]?.delta?.content;

        if (text) {
          onChunk?.(text);
        }
      }
    }

    finish();
  } catch (error) {
    onError?.(error);
  }
}
