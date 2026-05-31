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

    // Retrieve sources joined with job statuses
    const sources = db.prepare(`
      SELECT s.*, 
             j.status as job_status, 
             j.total_chunks, 
             j.processed_chunks, 
             j.error as job_error
      FROM sources s
      LEFT JOIN embedding_jobs j ON s.id = j.source_id
      WHERE s.notebook_id = ?
      ORDER BY s.created_at DESC
    `).all(notebookId);

    return NextResponse.json({ ok: true, data: sources });
  } catch (err) {
    console.error('[Sources API] GET error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
