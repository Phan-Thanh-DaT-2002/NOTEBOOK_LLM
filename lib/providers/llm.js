import { getDb } from '../db/connection.js';
import { decrypt } from '../crypto.js';

/**
 * Basic LLM completion helper for system tasks like source summarization
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} [customSettings]
 * @returns {Promise<string>}
 */
export async function generateCompletion(systemPrompt, userPrompt, customSettings = null) {
  let settings = customSettings;
  if (!settings) {
    const db = getDb();
    settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');
    if (!settings) {
      throw new Error('System settings are missing.');
    }
  }

  const provider = settings.provider || 'ollama';
  const model = settings.chat_model || 'llama3';
  const apiKey = settings.api_key_encrypted ? decrypt(settings.api_key_encrypted) : '';

  if (provider === 'ollama') {
    const url = `${settings.ollama_url || 'http://localhost:11434'}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        options: { 
          temperature: 0.3,
          num_ctx: 16384,
          num_predict: 2048,
        },
        stream: false
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      throw new Error(`Ollama chat error: HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.message?.content || '';

  } else if (provider === 'openai') {
    if (!apiKey) throw new Error('OpenAI API Key is missing.');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`OpenAI chat error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    return json.choices[0].message?.content || '';

  } else if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API Key is missing.');
    const modelName = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Input:\n${userPrompt}` }]
          }
        ],
        generationConfig: { temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`Gemini chat error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (provider === 'anthropic') {
    if (!apiKey) throw new Error('Anthropic API Key is missing.');
    const modelName = model || 'claude-3-5-haiku-latest';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`Anthropic chat error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    return json.content?.[0]?.text || '';
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
