import { decrypt } from '../crypto.js';

/**
 * Creates a ReadableStream yielding text tokens from the configured provider
 * @param {Array<object>} messages Chat messages [{ role, content }]
 * @param {object} settings Provider settings
 * @returns {Promise<ReadableStream>}
 */
export async function getChatStream(messages, settings, think = true) {
  const provider = settings.provider || 'ollama';
  const model = settings.chat_model || 'llama3';
  const apiKey = settings.api_key_encrypted ? decrypt(settings.api_key_encrypted) : '';

  let fetchUrl = '';
  let fetchHeaders = { 'Content-Type': 'application/json' };
  let fetchBody = {};

  if (provider === 'ollama') {
    fetchUrl = `${settings.ollama_url || 'http://localhost:11434'}/api/chat`;
    fetchBody = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      keep_alive: -1, // Keep model in VRAM indefinitely to eliminate loading delay
      options: {
        num_ctx: 16384, // Request 16k context size from Ollama
        num_predict: 2048, // Allow up to 2048 predicted tokens (helps long thinking + response)
      }
    };
  } else if (provider === 'openai') {
    if (!apiKey) throw new Error('OpenAI API Key is missing.');
    fetchUrl = 'https://api.openai.com/v1/chat/completions';
    fetchHeaders['Authorization'] = `Bearer ${apiKey}`;
    fetchBody = {
      model: model || 'gpt-4o-mini',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };
  } else if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API Key is missing.');
    const modelName = model || 'gemini-2.5-flash';
    fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`;
    
    // Map roles to Gemini format ('user' / 'model')
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    fetchBody = { contents };
  } else if (provider === 'anthropic') {
    if (!apiKey) throw new Error('Anthropic API Key is missing.');
    fetchUrl = 'https://api.anthropic.com/v1/messages';
    fetchHeaders['x-api-key'] = apiKey;
    fetchHeaders['anthropic-version'] = '2023-06-01';
    
    // Anthropic separates system prompt
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    fetchBody = {
      model: model || 'claude-3-5-haiku-latest',
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
      stream: true,
    };
    if (systemMessage) {
      fetchBody.system = systemMessage.content;
    }
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: fetchHeaders,
    body: JSON.stringify(fetchBody),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LLM provider stream request failed: HTTP ${response.status} - ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let lineBuffer = '';

  return new ReadableStream({
    async start(controller) {
      try {
        let inThinking = false;

        const processLine = (lineStr) => {
          const trimmed = lineStr.trim();
          if (!trimmed) return;

          const { content, thinking } = parseStreamLine(trimmed, provider);

          if (thinking) {
            if (think) {
              if (!inThinking) {
                inThinking = true;
                controller.enqueue('<think>\n' + thinking);
              } else {
                controller.enqueue(thinking);
              }
            }
          } else if (content) {
            if (inThinking) {
              inThinking = false;
              if (think) {
                controller.enqueue('\n</think>\n' + content);
              } else {
                controller.enqueue(content);
              }
            } else {
              controller.enqueue(content);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process remaining buffer
            if (lineBuffer.trim()) {
              processLine(lineBuffer);
            }
            if (inThinking && think) {
              controller.enqueue('\n</think>\n');
            }
            controller.close();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          lineBuffer += chunk;

          const lines = lineBuffer.split('\n');
          // Keep last unfinished line in buffer
          lineBuffer = lines.pop();

          for (const line of lines) {
            processLine(line);
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }
  });
}

/**
 * Parses single streaming line depending on provider format
 */
function parseStreamLine(line, provider) {
  if (provider === 'ollama') {
    try {
      const json = JSON.parse(line);
      const thinking = json.message?.thinking || json.thinking || '';
      const content = json.message?.content || json.content || '';
      return { content, thinking };
    } catch (e) {
      return { content: '', thinking: '' };
    }
  }

  if (provider === 'openai') {
    if (!line.startsWith('data:')) return { content: '', thinking: '' };
    const dataContent = line.replace(/^data:\s*/, '').trim();
    if (dataContent === '[DONE]') return { content: '', thinking: '' };
    try {
      const json = JSON.parse(dataContent);
      const delta = json.choices?.[0]?.delta;
      const content = delta?.content || '';
      const thinking = delta?.reasoning_content || '';
      return { content, thinking };
    } catch (e) {
      return { content: '', thinking: '' };
    }
  }

  if (provider === 'gemini') {
    // Gemini stream chunks might start/end with square brackets if array format
    let cleanLine = line.trim();
    if (cleanLine.startsWith('[')) cleanLine = cleanLine.substring(1);
    if (cleanLine.endsWith(']')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
    if (cleanLine.endsWith(',')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
    
    try {
      const json = JSON.parse(cleanLine.trim());
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { content, thinking: '' };
    } catch (e) {
      return { content: '', thinking: '' };
    }
  }

  if (provider === 'anthropic') {
    if (!line.startsWith('data:')) return { content: '', thinking: '' };
    const dataContent = line.replace(/^data:\s*/, '').trim();
    try {
      const json = JSON.parse(dataContent);
      if (json.type === 'content_block_delta') {
        const delta = json.delta || {};
        const content = delta.text || '';
        const thinking = delta.thinking || '';
        return { content, thinking };
      }
    } catch (e) {
      return { content: '', thinking: '' };
    }
  }

  return { content: '', thinking: '' };
}
