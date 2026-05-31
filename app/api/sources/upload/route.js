import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db/connection.js';
import { enqueueSourceIngestion } from '@/lib/jobs/queue.js';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const notebookId = formData.get('notebookId');

    if (!file || !notebookId) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'File and notebookId are required.' }
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

    const filename = file.name;
    const extension = path.extname(filename).toLowerCase();
    
    let fileType = 'txt';
    if (extension === '.pdf') {
      fileType = 'pdf';
    } else if (extension === '.docx') {
      fileType = 'docx';
    } else if (extension === '.md') {
      fileType = 'md';
    } else if (extension === '.csv') {
      fileType = 'csv';
    } else if (['.txt', '.text'].includes(extension)) {
      fileType = 'txt';
    } else {
      // Reject unsupported formats
      return NextResponse.json({
        ok: false,
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: `File extension ${extension} is not supported. Please upload PDF, DOCX, TXT, or MD.` }
      }, { status: 415 });
    }

    const sourceId = crypto.randomUUID();
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', sourceId);
    
    // Create upload directory
    fs.mkdirSync(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Insert source metadata
    db.prepare(`
      INSERT INTO sources (id, notebook_id, filename, file_type, file_path, sync_status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(sourceId, notebookId, filename, fileType, filePath);

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
    console.error('[Upload API] Error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
