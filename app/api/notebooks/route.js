import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const notebooks = db.prepare('SELECT * FROM notebooks ORDER BY updated_at DESC').all();
    return NextResponse.json({ ok: true, data: notebooks, error: null });
  } catch (error) {
    console.error('[API] GET /api/notebooks failed:', error);
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
    const title = body.title || 'Untitled Notebook';

    // Get default models from global settings
    const settings = db.prepare('SELECT chat_model, embedding_model FROM settings WHERE id = ?').get('global') || {};
    
    const id = uuidv4();
    const chat_model = body.chat_model || settings.chat_model || 'qwen2.5:7b';
    const embedding_model = body.embedding_model || settings.embedding_model || 'nomic-embed-text';
    const custom_instructions = body.custom_instructions || '';

    db.prepare(`
      INSERT INTO notebooks (id, title, chat_model, embedding_model, custom_instructions)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, chat_model, embedding_model, custom_instructions);

    const notebook = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);

    return NextResponse.json({ ok: true, data: notebook, error: null });
  } catch (error) {
    console.error('[API] POST /api/notebooks failed:', error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
