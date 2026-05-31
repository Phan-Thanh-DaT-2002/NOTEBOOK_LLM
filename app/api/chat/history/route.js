import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get('notebookId');

    if (!notebookId) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId parameter is required' }
      }, { status: 400 });
    }

    const db = getDb();
    
    // Check if notebook exists
    const notebook = db.prepare('SELECT id FROM notebooks WHERE id = ?').get(notebookId);
    if (!notebook) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Notebook not found' }
      }, { status: 404 });
    }

    // Retrieve chat history ordered by time
    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE notebook_id = ? 
      ORDER BY created_at ASC
    `).all(notebookId);

    // Fetch citations for assistant messages
    const citationStmt = db.prepare(`
      SELECT c.*, s.filename 
      FROM citations c
      JOIN sources s ON c.source_id = s.id
      WHERE c.message_id = ?
      ORDER BY c.citation_index ASC
    `);

    const enrichedMessages = messages.map(msg => {
      if (msg.role === 'assistant') {
        const citations = citationStmt.all(msg.id);
        return { ...msg, citations };
      }
      return msg;
    });

    return NextResponse.json({ ok: true, data: enrichedMessages });
  } catch (err) {
    console.error('[Chat History API] GET error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get('notebookId');

    if (!notebookId) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId parameter is required' }
      }, { status: 400 });
    }

    const db = getDb();
    
    // Check if notebook exists
    const notebook = db.prepare('SELECT id FROM notebooks WHERE id = ?').get(notebookId);
    if (!notebook) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Notebook not found' }
      }, { status: 404 });
    }

    // Clear chat history
    // CASCADE ON DELETE will automatically clear citations
    db.prepare('DELETE FROM chat_messages WHERE notebook_id = ?').run(notebookId);

    return NextResponse.json({ ok: true, data: { notebookId } });
  } catch (err) {
    console.error('[Chat History API] DELETE error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
