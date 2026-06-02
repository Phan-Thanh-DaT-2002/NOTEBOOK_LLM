import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';
import { parsePDF } from '../parsers/pdf.js';
import { parseDocx } from '../parsers/docx.js';
import { parseURL } from '../parsers/url.js';
import { parseYouTube } from '../parsers/youtube.js';
import { chunkDocument } from '../chunker.js';
import { getEmbeddings } from '../providers/embedding.js';
import { addVectors, checkChroma } from '../chroma.js';
import { generateCompletion } from '../providers/llm.js';
import { parseImage } from '../parsers/image.js';
import { cleanAIText } from '../utils.js';

/**
 * Executes the full parsing, chunking, embedding, and summary extraction workflow
 * @param {string} sourceId
 */
export async function processSource(sourceId) {
  const db = getDb();
  
  // 1. Get job and source details
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error(`Source ${sourceId} not found in database.`);
  }

  // Find or create embedding job
  let job = db.prepare('SELECT * FROM embedding_jobs WHERE source_id = ?').get(sourceId);
  const jobId = job ? job.id : crypto.randomUUID();
  if (!job) {
    db.prepare(`
      INSERT INTO embedding_jobs (id, source_id, status, total_chunks, processed_chunks)
      VALUES (?, ?, 'pending', 0, 0)
    `).run(jobId, sourceId);
  }

  // Update status to processing
  db.prepare(`
    UPDATE embedding_jobs 
    SET status = 'processing', error = NULL 
    WHERE id = ?
  `).run(jobId);
  
  db.prepare(`
    UPDATE sources 
    SET sync_status = 'processing' 
    WHERE id = ?
  `).run(sourceId);

  try {
    const systemSettings = db.prepare('SELECT provider, embedding_model, ollama_url, api_key_encrypted FROM settings WHERE id = ?').get('global');
    let rawText = '';
    let extractedTitle = source.filename;

    // 2. Parse text content based on file type
    if (source.file_type === 'pdf') {
      const buffer = fs.readFileSync(source.file_path);
      const parsed = await parsePDF(buffer);
      rawText = parsed.text;
    } else if (source.file_type === 'docx') {
      const buffer = fs.readFileSync(source.file_path);
      const parsed = await parseDocx(buffer);
      rawText = parsed.text;
    } else if (source.file_type === 'txt' || source.file_type === 'md') {
      rawText = fs.readFileSync(source.file_path, 'utf8');
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(source.file_type)) {
      const parsed = await parseImage(source.file_path, systemSettings);
      rawText = parsed.text;
    } else if (source.file_type === 'url') {
      const parsed = await parseURL(source.original_url);
      rawText = parsed.text;
      extractedTitle = parsed.title;
    } else if (source.file_type === 'youtube') {
      const parsed = await parseYouTube(source.original_url);
      rawText = parsed.text;
      extractedTitle = parsed.title;
    } else if (source.file_type === 'text') {
      rawText = source.raw_text || '';
    }

    if (!rawText.trim()) {
      throw new Error('Extracted document content is empty.');
    }

    // Clean up carriage returns/multiple spaces
    rawText = rawText.replace(/\r\n/g, '\n').replace(/ {2,}/g, ' ');

    // Get word count
    const wordCount = rawText.split(/\s+/).filter(Boolean).length;

    // Update source details in SQLite
    db.prepare(`
      UPDATE sources 
      SET raw_text = ?, filename = ?, word_count = ?
      WHERE id = ?
    `).run(rawText, extractedTitle, wordCount, sourceId);

    // 3. Chunk the document
    const chunks = chunkDocument(rawText, { fileType: source.file_type });
    if (chunks.length === 0) {
      throw new Error('Chunking failed. No text chunks generated.');
    }

    // Update total chunks count in job
    db.prepare(`
      UPDATE embedding_jobs 
      SET total_chunks = ? 
      WHERE id = ?
    `).run(chunks.length, jobId);

    // Get default embedding model name
    const notebook = db.prepare('SELECT embedding_model FROM notebooks WHERE id = ?').get(source.notebook_id);
    const embeddingModel = notebook?.embedding_model || systemSettings?.embedding_model || 'nomic-embed-text';

    // 4. Generate Embeddings & Save Chunks
    const chromaOnline = await checkChroma();
    
    // Prepare structures
    const chunkIds = [];
    const chunkTexts = [];
    const chunkEmbeddings = [];
    const chunkMetadatas = [];

    // Loop chunks and write to SQLite + accumulate vector requests
    const insertChunkStmt = db.prepare(`
      INSERT INTO chunks (id, source_id, notebook_id, content, chunk_index, page_number, char_start, char_end, embedding_id, embedding_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Process chunk contents
    const chunkTextsOnly = chunks.map(c => c.content);
    
    let embeddings = [];
    if (chromaOnline) {
      // Fetch embeddings for the whole batch
      embeddings = await getEmbeddings(chunkTextsOnly, systemSettings);
    } else {
      console.warn('[ProcessSource] ChromaDB is offline. Skipping embedding generation.');
    }

    // Execute SQLite inserts and prepare ChromaDB records
    db.transaction(() => {
      chunks.forEach((chunk, idx) => {
        const chunkId = crypto.randomUUID();
        const embeddingId = chromaOnline ? `vec_${chunkId}` : null;

        // Insert into SQLite
        insertChunkStmt.run(
          chunkId,
          sourceId,
          source.notebook_id,
          chunk.content,
          chunk.chunk_index,
          chunk.page_number,
          chunk.char_start,
          chunk.char_end,
          embeddingId,
          embeddingModel
        );

        if (chromaOnline && embeddings[idx]) {
          chunkIds.push(embeddingId);
          chunkTexts.push(chunk.content);
          chunkEmbeddings.push(embeddings[idx]);
          chunkMetadatas.push({
            notebook_id: source.notebook_id,
            source_id: sourceId,
            chunk_id: chunkId,
          });
        }

        // Update processed count
        db.prepare(`
          UPDATE embedding_jobs 
          SET processed_chunks = ? 
          WHERE id = ?
        `).run(idx + 1, jobId);
      });
    })();

    // 5. Upload vectors to ChromaDB (if online)
    if (chromaOnline && chunkIds.length > 0) {
      await addVectors(chunkIds, chunkEmbeddings, chunkMetadatas, chunkTexts);
    }

    // 6. Generate Summary via LLM
    let summaryText = 'No summary generated.';
    try {
      const summarySnippet = rawText.substring(0, 3000); // Send first 3000 chars for summary
      const systemPrompt = 'You are a research assistant. Summarize the provided document context in 3-5 clear, concise sentences in the language of the document. Do not include introductory phrases like "Here is a summary".';
      const userPrompt = `Document content snippet:\n\n${summarySnippet}`;
      
      summaryText = await generateCompletion(systemPrompt, userPrompt, systemSettings);
    } catch (err) {
      console.error('[ProcessSource] Summary generation failed:', err);
    }

    // 7. Update status to ready
    db.prepare(`
      UPDATE sources 
      SET summary = ?, sync_status = 'ready' 
      WHERE id = ?
    `).run(cleanAIText(summaryText), sourceId);

    db.prepare(`
      UPDATE embedding_jobs 
      SET status = 'done', finished_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(jobId);

  } catch (err) {
    console.error(`[ProcessSource] Ingestion failed for source ${sourceId}:`, err);
    
    db.prepare(`
      UPDATE sources 
      SET sync_status = 'error' 
      WHERE id = ?
    `).run(sourceId);

    db.prepare(`
      UPDATE embedding_jobs 
      SET status = 'error', error = ? 
      WHERE id = ?
    `).run(err.message || 'Unknown error', jobId);
  }
}
