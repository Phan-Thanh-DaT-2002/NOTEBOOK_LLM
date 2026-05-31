import { getDb } from '../db/connection.js';
import { getEmbeddings } from '../providers/embedding.js';
import { queryVectors, checkChroma } from '../chroma.js';

/**
 * Retrieves the most relevant text chunks for a query
 * @param {string} query User question
 * @param {string} notebookId
 * @param {number} [topK]
 * @returns {Promise<Array<{id: string, content: string, source_id: string, filename: string, page_number: number|null, char_start: number, char_end: number}>>}
 */
export async function retrieveContext(query, notebookId, topK = 6) {
  const db = getDb();
  
  // 1. Fetch enabled sources for this notebook
  const enabledSources = db.prepare(`
    SELECT id, filename FROM sources 
    WHERE notebook_id = ? AND enabled = 1 AND sync_status = 'ready'
  `).all(notebookId);

  if (enabledSources.length === 0) {
    return [];
  }

  const enabledSourceIds = enabledSources.map(s => s.id);
  const sourceNamesMap = Object.fromEntries(enabledSources.map(s => [s.id, s.filename]));

  // 2. Check if ChromaDB is reachable
  const isChromaOnline = await checkChroma();

  if (isChromaOnline) {
    try {
      // Generate query embedding
      const queryEmbeds = await getEmbeddings([query]);
      if (queryEmbeds && queryEmbeds[0]) {
        // Construct ChromaDB where filter
        // If only 1 source, Chroma prefers equality, else use $in
        const whereFilter = enabledSourceIds.length === 1 
          ? { source_id: enabledSourceIds[0] }
          : { source_id: { $in: enabledSourceIds } };

        const results = await queryVectors(queryEmbeds[0], topK, whereFilter);
        
        if (results && results.documents && results.documents[0]) {
          const documents = results.documents[0];
          const metadatas = results.metadatas[0];
          const ids = results.ids[0];

          const formatted = [];
          for (let i = 0; i < documents.length; i++) {
            const meta = metadatas[i];
            
            // Fetch additional metadata from SQLite chunks if needed
            const chunk = db.prepare('SELECT page_number, char_start, char_end FROM chunks WHERE id = ?').get(meta.chunk_id);

            formatted.push({
              id: meta.chunk_id || ids[i],
              content: documents[i],
              source_id: meta.source_id,
              filename: sourceNamesMap[meta.source_id] || 'Unknown Source',
              page_number: chunk?.page_number || null,
              char_start: chunk?.char_start || 0,
              char_end: chunk?.char_end || 0,
            });
          }
          return formatted;
        }
      }
    } catch (err) {
      console.warn('[Retriever] Chroma query failed, falling back to SQLite text search:', err);
    }
  }

  // 3. FALLBACK: Keyword SQL search in SQLite if ChromaDB is down or query fails
  console.log('[Retriever] Executing fallback SQLite text search.');
  
  // Split query into keywords (remove short/common stop words)
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ') // support Vietnamese unicode chars
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (keywords.length === 0) {
    // Fallback: just return the latest chunks of enabled sources
    const placeholders = enabledSourceIds.map(() => '?').join(',');
    const fallbackChunks = db.prepare(`
      SELECT c.*, s.filename 
      FROM chunks c
      JOIN sources s ON c.source_id = s.id
      WHERE c.notebook_id = ? AND c.source_id IN (${placeholders})
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(notebookId, ...enabledSourceIds, topK);

    return fallbackChunks.map(c => ({
      id: c.id,
      content: c.content,
      source_id: c.source_id,
      filename: c.filename,
      page_number: c.page_number,
      char_start: c.char_start,
      char_end: c.char_end,
    }));
  }

  // Build keyword query clauses
  const placeholders = enabledSourceIds.map(() => '?').join(',');
  const likeClauses = keywords.map(() => 'c.content LIKE ?').join(' OR ');
  const sql = `
    SELECT c.*, s.filename 
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE c.notebook_id = ? 
      AND c.source_id IN (${placeholders})
      AND (${likeClauses})
    LIMIT ?
  `;

  const likeParams = keywords.map(w => `%${w}%`);
  const queryParams = [notebookId, ...enabledSourceIds, ...likeParams, topK];

  const matchedChunks = db.prepare(sql).all(...queryParams);

  return matchedChunks.map(c => ({
    id: c.id,
    content: c.content,
    source_id: c.source_id,
    filename: c.filename,
    page_number: c.page_number,
    char_start: c.char_start,
    char_end: c.char_end,
  }));
}
