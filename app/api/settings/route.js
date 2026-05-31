import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import { encrypt, decrypt } from '@/lib/crypto.js';

export async function GET() {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');

    if (!settings) {
      return NextResponse.json({ ok: true, data: {}, error: null });
    }

    // Decrypt key for UI display
    const rawApiKey = settings.api_key_encrypted ? decrypt(settings.api_key_encrypted) : '';

    return NextResponse.json({
      ok: true,
      data: {
        provider: settings.provider,
        apiKey: rawApiKey,
        ollamaUrl: settings.ollama_url,
        chatModel: settings.chat_model,
        embeddingModel: settings.embedding_model,
        ttsProvider: settings.tts_provider,
        theme: settings.theme,
      },
      error: null,
    });
  } catch (error) {
    console.error('[API] GET /api/settings failed:', error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    // Retrieve current settings to handle empty/masked API keys
    const current = db.prepare('SELECT api_key_encrypted FROM settings WHERE id = ?').get('global') || {};

    let apiKeyEncrypted = current.api_key_encrypted;
    
    if (body.apiKey !== undefined) {
      if (body.apiKey === '') {
        apiKeyEncrypted = null;
      } else {
        // Only encrypt if it's not a masked representation
        const isMasked = body.apiKey.includes('••••');
        if (!isMasked) {
          apiKeyEncrypted = encrypt(body.apiKey);
        }
      }
    }

    db.prepare(`
      UPDATE settings
      SET provider = ?,
          api_key_encrypted = ?,
          ollama_url = ?,
          chat_model = ?,
          embedding_model = ?,
          tts_provider = ?,
          theme = ?
      WHERE id = 'global'
    `).run(
      body.provider || 'ollama',
      apiKeyEncrypted,
      body.ollamaUrl || 'http://localhost:11434',
      body.chatModel || 'qwen2.5:7b',
      body.embeddingModel || 'nomic-embed-text',
      body.ttsProvider || 'browser',
      body.theme || 'dark'
    );

    const updated = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');
    const rawApiKey = updated.api_key_encrypted ? decrypt(updated.api_key_encrypted) : '';

    return NextResponse.json({
      ok: true,
      data: {
        provider: updated.provider,
        apiKey: rawApiKey,
        ollamaUrl: updated.ollama_url,
        chatModel: updated.chat_model,
        embeddingModel: updated.embedding_model,
        ttsProvider: updated.tts_provider,
        theme: updated.theme,
      },
      error: null,
    });
  } catch (error) {
    console.error('[API] POST /api/settings failed:', error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
