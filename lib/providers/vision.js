import fs from 'fs';
import { getDb } from '../db/connection.js';
import { decrypt } from '../crypto.js';

/**
 * Generates a description of an image using the active LLM provider (multimodal)
 * @param {string} filePath
 * @param {string} mimeType
 * @param {object} [customSettings]
 * @returns {Promise<string>}
 */
export async function generateVisionDescription(filePath, mimeType, customSettings = null) {
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

  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString('base64');
  const promptText = "Hãy mô tả chi tiết nội dung của bức ảnh này bằng tiếng Việt (bao gồm các thực thể, hoạt động, sơ đồ, biểu đồ hoặc chữ nếu có).";

  // Normalize mime type (e.g. image/jpg is not valid in some APIs, must be image/jpeg)
  let normalizedMime = mimeType;
  if (mimeType === 'image/jpg') {
    normalizedMime = 'image/jpeg';
  }

  if (provider === 'ollama') {
    const url = `${settings.ollama_url || 'http://localhost:11434'}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: 'user', 
            content: promptText,
            images: [base64Image]
          }
        ],
        options: { temperature: 0.3 },
        stream: false
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      throw new Error(`Ollama vision error: HTTP ${res.status}`);
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
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: `data:${normalizedMime};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`OpenAI vision error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
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
            parts: [
              { inlineData: { mimeType: normalizedMime, data: base64Image } },
              { text: promptText }
            ]
          }
        ],
        generationConfig: { temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`Gemini vision error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (provider === 'anthropic') {
    if (!apiKey) throw new Error('Anthropic API Key is missing.');
    const modelName = model || 'claude-3-5-sonnet-latest';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: normalizedMime,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: promptText
              }
            ]
          }
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`Anthropic vision error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    return json.content?.[0]?.text || '';
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
