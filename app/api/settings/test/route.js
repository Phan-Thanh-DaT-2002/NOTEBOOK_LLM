import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { provider, apiKey, ollamaUrl } = body;

    if (provider === 'ollama') {
      const url = ollamaUrl || 'http://localhost:11434';
      try {
        const response = await fetch(`${url}/api/tags`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          // Short timeout for local testing
          signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        const models = (data.models || []).map(m => m.name);
        
        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: {
            code: 'OLLAMA_CONNECTION_FAILED',
            message: `Cannot connect to Ollama at ${url}. Make sure Ollama is running.`,
            details: err.message,
          },
        });
      }
    }

    if (provider === 'openai') {
      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: { code: 'API_KEY_REQUIRED', message: 'OpenAI API key is required' },
        });
      }

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        // Filter standard GPT models to keep list clean
        const models = (data.data || [])
          .map(m => m.id)
          .filter(id => id.startsWith('gpt-') || id.includes('text-embedding'));

        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: {
            code: 'OPENAI_CONNECTION_FAILED',
            message: `OpenAI verification failed: ${err.message}`,
          },
        });
      }
    }

    if (provider === 'gemini') {
      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: { code: 'API_KEY_REQUIRED', message: 'Gemini API key is required' },
        });
      }

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        const models = (data.models || [])
          .map(m => m.name.replace('models/', ''))
          .filter(name => name.includes('gemini') || name.includes('embedding'));

        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: {
            code: 'GEMINI_CONNECTION_FAILED',
            message: `Gemini verification failed: ${err.message}`,
          },
        });
      }
    }

    if (provider === 'anthropic') {
      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: { code: 'API_KEY_REQUIRED', message: 'Anthropic API key is required' },
        });
      }

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

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        const models = (data.data || []).map(m => m.id);

        return NextResponse.json({ ok: true, data: { models }, error: null });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          data: null,
          error: {
            code: 'ANTHROPIC_CONNECTION_FAILED',
            message: `Anthropic verification failed: ${err.message}`,
          },
        });
      }
    }

    return NextResponse.json({
      ok: false,
      data: null,
      error: { code: 'INVALID_PROVIDER', message: `Unknown provider: ${provider}` },
    });
  } catch (error) {
    console.error('[API] POST /api/settings/test failed:', error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
