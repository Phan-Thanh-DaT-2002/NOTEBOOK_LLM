import { decrypt } from '../crypto.js';

/**
 * Creates a ReadableStream yielding text tokens from the configured provider
 * @param {Array<object>} messages Chat messages [{ role, content }]
 * @param {object} settings Provider settings
 * @returns {Promise<ReadableStream>}
 */
export async function getChatStream(messages, settings) {
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
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process remaining buffer
            if (lineBuffer.trim()) {
              const token = parseStreamLine(lineBuffer, provider);
              if (token) controller.enqueue(token);
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
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const token = parseStreamLine(trimmed, provider);
            if (token) {
              controller.enqueue(token);
            }
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
      return json.message?.content || '';
    } catch (e) {
      return '';
    }
  }

  if (provider === 'openai') {
    if (!line.startsWith('data:')) return '';
    const dataContent = line.replace(/^data:\s*/, '').trim();
    if (dataContent === '[DONE]') return '';
    try {
      const json = JSON.parse(dataContent);
      return json.choices?.[0]?.delta?.content || '';
    } catch (e) {
      return '';
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
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      return '';
    }
  }

  if (provider === 'anthropic') {
    if (!line.startsWith('data:')) return '';
    const dataContent = line.replace(/^data:\s*/, '').trim();
    try {
      const json = JSON.parse(dataContent);
      if (json.type === 'content_block_delta') {
        return json.delta?.text || '';
      }
    } catch (e) {
      return '';
    }
  }

  return '';
}
