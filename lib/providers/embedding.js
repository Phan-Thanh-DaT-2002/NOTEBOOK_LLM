import { getDb } from '../db/connection.js';
import { decrypt } from '../crypto.js';

/**
 * Generates embeddings for a single text using the configured provider
 * @param {string} text
 * @param {object} settings
 * @returns {Promise<Array<number>>}
 */
async function embedSingle(text, settings) {
  const provider = settings.provider || 'ollama';
  const model = settings.embedding_model || 'nomic-embed-text';
  const apiKey = settings.api_key_encrypted ? decrypt(settings.api_key_encrypted) : '';

  if (provider === 'ollama') {
    const url = `${settings.ollama_url || 'http://localhost:11434'}/api/embeddings`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Ollama embedding error: HTTP ${res.status}`);
    }

    const json = await res.json();
    if (!json.embedding) {
      throw new Error('Ollama returned empty embedding response.');
    }
    return json.embedding;

  } else if (provider === 'openai') {
    if (!apiKey) throw new Error('OpenAI API Key is missing.');
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: text,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`OpenAI embedding error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    return json.data[0].embedding;

  } else if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API Key is missing.');
    const modelName = model || 'text-embedding-004';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(`Gemini embedding error: ${errorJson.error?.message || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    if (!json.embedding?.values) {
      throw new Error('Gemini returned empty embedding response.');
    }
    return json.embedding.values;

  } else {
    throw new Error(`Unsupported embedding provider: ${provider}`);
  }
}

/**
 * Generates embeddings for an array of texts, mapping calls with a concurrency limit
 * @param {Array<string>} texts
 * @param {object} [customSettings] Optional setting override
 * @returns {Promise<Array<Array<number>>>}
 */
export async function getEmbeddings(texts, customSettings = null) {
  let settings = customSettings;
  if (!settings) {
    const db = getDb();
    settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');
    if (!settings) {
      throw new Error('System settings are missing.');
    }
  }

  // To prevent HTTP failures, run in chunks of 5 parallel requests
  const results = [];
  const chunkSize = 5;

  for (let i = 0; i < texts.length; i += chunkSize) {
    const batch = texts.slice(i, i + chunkSize);
    const batchPromises = batch.map(text => embedSingle(text, settings));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
