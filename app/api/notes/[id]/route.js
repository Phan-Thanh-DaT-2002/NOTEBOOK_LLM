import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { title, content, pinned } = body;

    const db = getDb();
    
    // Check if note exists
    const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(id);
    if (!note) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Note not found.' }
      }, { status: 404 });
    }

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (pinned !== undefined) {
      updates.push('pinned = ?');
      values.push(pinned ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id); // for the WHERE id = ? clause
      
      db.prepare(`
        UPDATE notes 
        SET ${updates.join(', ')} 
        WHERE id = ?
      `).run(...values);
    }

    const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);

    return NextResponse.json({
      ok: true,
      data: updatedNote
    });
  } catch (error) {
    console.error('[Notes ID API] PATCH failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if note exists
    const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(id);
    if (!note) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Note not found.' }
      }, { status: 404 });
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(id);

    return NextResponse.json({
      ok: true,
      data: { id }
    });
  } catch (error) {
    console.error('[Notes ID API] DELETE failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}
