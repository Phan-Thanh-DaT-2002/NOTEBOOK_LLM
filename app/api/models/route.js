import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import { decrypt } from '@/lib/crypto.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');

    if (!settings) {
      return NextResponse.json({ ok: true, data: { models: [] }, error: null });
    }

    const provider = settings.provider;
    const apiKey = settings.api_key_encrypted ? decrypt(settings.api_key_encrypted) : '';
    const url = settings.ollama_url || 'http://localhost:11434';

    if (provider === 'ollama') {
      try {
        const response = await fetch(`${url}/api/tags`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const models = (data.models || []).map(m => m.name);
        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        // Fallback default list if Ollama is not running but we want to display choices
        const defaults = ['qwen2.5:7b', 'llama3.1:8b', 'nomic-embed-text'];
        return NextResponse.json({ ok: true, data: { models: defaults, offline: true }, error: null });
      }
    }

    if (provider === 'openai') {
      if (!apiKey) return NextResponse.json({ ok: true, data: { models: [] } });
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const models = (data.data || [])
          .map(m => m.id)
          .filter(id => id.startsWith('gpt-') || id.includes('text-embedding'));
        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({ ok: true, data: { models: ['gpt-4o-mini', 'gpt-4o', 'text-embedding-3-small'] } });
      }
    }

    if (provider === 'gemini') {
      if (!apiKey) return NextResponse.json({ ok: true, data: { models: [] } });
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const models = (data.models || [])
          .map(m => m.name.replace('models/', ''))
          .filter(name => name.includes('gemini') || name.includes('embedding'));
        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({ ok: true, data: { models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'text-embedding-004'] } });
      }
    }

    if (provider === 'anthropic') {
      if (!apiKey) return NextResponse.json({ ok: true, data: { models: [] } });
      try {
        const response = await fetch('https://api.anthropic.com/v1/models', {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const models = (data.data || []).map(m => m.id);
        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({ ok: true, data: { models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] } });
      }
    }

    return NextResponse.json({ ok: true, data: { models: [] } });
  } catch (error) {
    console.error('[API] GET /api/models failed:', error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
