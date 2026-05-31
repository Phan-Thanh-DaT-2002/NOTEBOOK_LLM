import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import { enqueueSourceIngestion } from '@/lib/jobs/queue.js';
import crypto from 'crypto';
import { getYouTubeId } from '@/lib/parsers/youtube.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { notebookId, type, url, text, filename } = body;

    if (!notebookId || !type) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId and type are required fields.' }
      }, { status: 400 });
    }

    if (!['url', 'youtube', 'text'].includes(type)) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid type. Must be url, youtube, or text.' }
      }, { status: 400 });
    }

    const db = getDb();
    
    // Check if notebook exists
    const notebook = db.prepare('SELECT id FROM notebooks WHERE id = ?').get(notebookId);
    if (!notebook) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Notebook not found.' }
      }, { status: 404 });
    }

    let sourceFilename = '';
    let originalUrl = null;
    let rawText = null;

    if (type === 'url') {
      if (!url) {
        return NextResponse.json({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'url is required for link imports.' }
        }, { status: 400 });
      }
      originalUrl = url;
      sourceFilename = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0] || 'Web Page';
    } else if (type === 'youtube') {
      if (!url) {
        return NextResponse.json({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'url is required for YouTube imports.' }
        }, { status: 400 });
      }
      const videoId = getYouTubeId(url);
      if (!videoId) {
        return NextResponse.json({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'Could not extract valid Video ID from YouTube URL.' }
        }, { status: 400 });
      }
      originalUrl = url;
      sourceFilename = `YouTube Video (${videoId})`;
    } else if (type === 'text') {
      if (!text) {
        return NextResponse.json({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'text is required for pasted text imports.' }
        }, { status: 400 });
      }
      rawText = text;
      sourceFilename = filename?.trim() || 'Pasted Text';
    }

    const sourceId = crypto.randomUUID();

    // Insert source metadata
    db.prepare(`
      INSERT INTO sources (id, notebook_id, filename, file_type, original_url, raw_text, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(sourceId, notebookId, sourceFilename, type, originalUrl, rawText);

    // Initialize job status
    const jobId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO embedding_jobs (id, source_id, status, total_chunks, processed_chunks)
      VALUES (?, ?, 'pending', 0, 0)
    `).run(jobId, sourceId);

    // Enqueue ingestion in background worker
    enqueueSourceIngestion(sourceId);

    // Fetch the newly created source
    const createdSource = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);

    return NextResponse.json({
      ok: true,
      data: createdSource
    });
  } catch (err) {
    console.error('[Import API] Error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
