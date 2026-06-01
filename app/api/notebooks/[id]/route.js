import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    const notebook = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);

    if (!notebook) {
      return NextResponse.json(
        { ok: false, data: null, error: { code: 'NOT_FOUND', message: 'Notebook not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: notebook, error: null });
  } catch (error) {
    console.error(`[API] GET /api/notebooks/${id} failed:`, error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    // Check if notebook exists
    const notebook = db.prepare('SELECT 1 FROM notebooks WHERE id = ?').get(id);
    if (!notebook) {
      return NextResponse.json(
        { ok: false, data: null, error: { code: 'NOT_FOUND', message: 'Notebook not found' } },
        { status: 404 }
      );
    }

    // Build patch query dynamically
    const allowedKeys = [
      'title',
      'chat_model',
      'embedding_model',
      'custom_instructions',
      'chat_style',
      'response_length',
    ];

    const fields = [];
    const values = [];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id); // for WHERE id = ?

      const query = `UPDATE notebooks SET ${fields.join(', ')} WHERE id = ?`;
      db.prepare(query).run(...values);
    }

    const updatedNotebook = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);
    return NextResponse.json({ ok: true, data: updatedNotebook, error: null });
  } catch (error) {
    console.error(`[API] PATCH /api/notebooks/${id} failed:`, error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if notebook exists
    const notebook = db.prepare('SELECT 1 FROM notebooks WHERE id = ?').get(id);
    if (!notebook) {
      return NextResponse.json(
        { ok: false, data: null, error: { code: 'NOT_FOUND', message: 'Notebook not found' } },
        { status: 404 }
      );
    }

    // Safe delete files from disk
    const sources = db.prepare('SELECT file_path FROM sources WHERE notebook_id = ?').all();
    for (const source of sources) {
      if (source.file_path) {
        try {
          const absolutePath = path.isAbsolute(source.file_path)
            ? source.file_path
            : path.join(process.cwd(), source.file_path);

          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            
            // Try to remove parent folder data/uploads/{source_id}
            const parentDir = path.dirname(absolutePath);
            if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
              fs.rmdirSync(parentDir);
            }
          }
        } catch (e) {
          console.warn('[DB] Failed to delete local file during cascade:', source.file_path, e);
        }
      }
    }

    // Delete notebook row (cascades automatically to all SQLite tables)
    db.prepare('DELETE FROM notebooks WHERE id = ?').run(id);

    return NextResponse.json({ ok: true, data: { id }, error: null });
  } catch (error) {
    console.error(`[API] DELETE /api/notebooks/${id} failed:`, error);
    return NextResponse.json(
      { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
