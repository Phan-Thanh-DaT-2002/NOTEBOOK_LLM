import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get('notebookId');
    const artifactId = searchParams.get('artifactId');

    const db = getDb();

    if (artifactId) {
      const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(artifactId);
      if (!artifact) {
        return NextResponse.json({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Artifact not found.' }
        }, { status: 404 });
      }

      let items = [];
      if (artifact.status === 'ready') {
        items = db.prepare(`
          SELECT ai.*, sp.status as progress_status, sp.score, sp.attempts, sp.last_seen_at
          FROM artifact_items ai
          LEFT JOIN study_progress sp ON sp.item_id = ai.id AND sp.artifact_id = ai.artifact_id
          WHERE ai.artifact_id = ?
          ORDER BY ai.sort_order ASC
        `).all(artifactId);

        items = items.map(item => ({
          ...item,
          content: JSON.parse(item.content_json)
        }));
      }

      return NextResponse.json({
        ok: true,
        data: {
          ...artifact,
          items
        }
      });
    }

    if (!notebookId) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId or artifactId must be provided.' }
      }, { status: 400 });
    }

    const artifacts = db.prepare(`
      SELECT id, notebook_id, type, title, status, error_message, created_at, updated_at 
      FROM artifacts 
      WHERE notebook_id = ? 
      ORDER BY created_at DESC
    `).all(notebookId);

    return NextResponse.json({
      ok: true,
      data: artifacts
    });
  } catch (error) {
    console.error('[Artifacts API] GET failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}
