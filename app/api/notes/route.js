import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get('notebookId');

    if (!notebookId) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId is required.' }
      }, { status: 400 });
    }

    const db = getDb();
    const notes = db.prepare(`
      SELECT * FROM notes 
      WHERE notebook_id = ? 
      ORDER BY pinned DESC, updated_at DESC
    `).all(notebookId);

    return NextResponse.json({
      ok: true,
      data: notes
    });
  } catch (error) {
    console.error('[Notes API] GET failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { notebookId, title = '', content, type = 'written', sourceMessageId = null } = body;

    if (!notebookId || !content) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId and content are required.' }
      }, { status: 400 });
    }

    if (!['written', 'saved'].includes(type)) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid note type. Must be written or saved.' }
      }, { status: 400 });
    }

    const db = getDb();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO notes (id, notebook_id, title, content, type, source_message_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, notebookId, title, content, type, sourceMessageId);

    const createdNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);

    return NextResponse.json({
      ok: true,
      data: createdNote
    });
  } catch (error) {
    console.error('[Notes API] POST failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}
