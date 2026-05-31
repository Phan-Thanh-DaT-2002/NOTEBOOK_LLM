import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { artifactId, itemId, status, score } = body;

    if (!artifactId || !itemId || !status) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'artifactId, itemId, and status are required fields.' }
      }, { status: 400 });
    }

    if (!['unseen', 'correct', 'incorrect', 'skipped'].includes(status)) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'status must be unseen, correct, incorrect, or skipped.' }
      }, { status: 400 });
    }

    const db = getDb();
    
    // Check if progress already exists for this item
    const existing = db.prepare('SELECT id FROM study_progress WHERE artifact_id = ? AND item_id = ?').get(artifactId, itemId);
    
    if (existing) {
      db.prepare(`
        UPDATE study_progress 
        SET status = ?, score = ?, attempts = attempts + 1, last_seen_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(status, score !== undefined ? score : null, existing.id);
    } else {
      const progressId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO study_progress (id, artifact_id, item_id, status, score, attempts, last_seen_at)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(progressId, artifactId, itemId, status, score !== undefined ? score : null);
    }

    return NextResponse.json({
      ok: true,
      error: null
    });
  } catch (error) {
    console.error('[Progress API] POST failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}
