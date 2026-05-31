import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db/connection.js';
import { deleteVectors } from '@/lib/chroma.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    const source = db.prepare(`
      SELECT s.*, 
             j.status as job_status, 
             j.total_chunks, 
             j.processed_chunks, 
             j.error as job_error
      FROM sources s
      LEFT JOIN embedding_jobs j ON s.id = j.source_id
      WHERE s.id = ?
    `).get(id);

    if (!source) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Source not found.' }
      }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: source });
  } catch (err) {
    console.error('[Source Detail API] GET error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { filename, enabled } = body;

    const db = getDb();
    
    // Check if source exists
    const source = db.prepare('SELECT id FROM sources WHERE id = ?').get(id);
    if (!source) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Source not found.' }
      }, { status: 404 });
    }

    // Build update parameters dynamically
    const updates = [];
    const values = [];

    if (filename !== undefined) {
      updates.push('filename = ?');
      values.push(filename.trim());
    }
    
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'No fields provided for update.' }
      }, { status: 400 });
    }

    values.push(id);
    db.prepare(`
      UPDATE sources 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `).run(...values);

    const updatedSource = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);

    return NextResponse.json({ ok: true, data: updatedSource });
  } catch (err) {
    console.error('[Source Detail API] PATCH error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if source exists
    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
    if (!source) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Source not found.' }
      }, { status: 404 });
    }

    try {
      // 1. Delete ChromaDB vectors
      await deleteVectors({ source_id: id });

      // 2. Remove local uploaded files
      if (source.file_path && fs.existsSync(source.file_path)) {
        const uploadDir = path.dirname(source.file_path);
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }

      // 3. Delete SQLite record
      // SQLite CASCADE ON DELETE will automatically purge corresponding chunks, citations, jobs
      db.prepare('DELETE FROM sources WHERE id = ?').run(id);

      return NextResponse.json({ ok: true, data: { id } });
    } catch (err) {
      console.error(`[Source Delete API] Error during deletion process for ${id}:`, err);
      
      // Update status to mark deletion failure
      db.prepare("UPDATE sources SET sync_status = 'delete_failed' WHERE id = ?").run(id);

      return NextResponse.json({
        ok: false,
        error: { code: 'DELETE_FAILED', message: `Safe delete failed: ${err.message}` }
      }, { status: 500 });
    }
  } catch (err) {
    console.error('[Source Detail API] DELETE error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
