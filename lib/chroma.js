const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const DEFAULT_COLLECTION_NAME = 'notebook_chunks';

/**
 * Checks if ChromaDB is reachable
 * @returns {Promise<boolean>}
 */
export async function checkChroma() {
  try {
    const res = await fetch(`${CHROMA_URL}/api/v1/heartbeat`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Helper to execute ChromaDB API requests
 */
async function chromaRequest(endpoint, method = 'GET', body = null) {
  const url = `${CHROMA_URL}/api/v1${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ChromaDB API error on ${method} ${endpoint}: HTTP ${res.status} - ${errText}`);
  }
  
  return res.json();
}

/**
 * Gets or creates the default collection
 * @returns {Promise<string>} The collection ID
 */
export async function getOrCreateCollection() {
  try {
    // 1. Check if collection already exists
    try {
      const col = await chromaRequest(`/collections/${DEFAULT_COLLECTION_NAME}`);
      return col.id;
    } catch (err) {
      // 2. Create if not exists
      const col = await chromaRequest('/collections', 'POST', {
        name: DEFAULT_COLLECTION_NAME,
        metadata: { description: 'Local Notebook AI main chunks store' },
      });
      return col.id;
    }
  } catch (err) {
    console.error('[ChromaDB] Failed to get or create collection:', err);
    throw new Error('ChromaDB vector store is offline. Please make sure Docker is running.');
  }
}

/**
 * Adds vectors to the default collection
 * @param {Array<string>} ids Chunk UUIDs
 * @param {Array<Array<number>>} embeddings Vectors
 * @param {Array<object>} metadatas Metadata objects (e.g. { notebook_id, source_id })
 * @param {Array<string>} documents Chunks text contents
 */
export async function addVectors(ids, embeddings, metadatas, documents) {
  const collectionId = await getOrCreateCollection();
  await chromaRequest(`/collections/${collectionId}/add`, 'POST', {
    ids,
    embeddings,
    metadatas,
    documents,
  });
}

/**
 * Queries vectors in the collection with metadata filters
 * @param {Array<number>} queryEmbedding Vector to search
 * @param {number} nResults Top-k results
 * @param {object} where Metadata filters (e.g. { notebook_id, source_id })
 * @returns {Promise<object>} Query results
 */
export async function queryVectors(queryEmbedding, nResults = 5, where = {}) {
  const collectionId = await getOrCreateCollection();
  return await chromaRequest(`/collections/${collectionId}/query`, 'POST', {
    query_embeddings: [queryEmbedding],
    n_results: nResults,
    where,
  });
}

/**
 * Deletes vectors matching criteria
 * @param {object} where Metadata filter to delete (e.g. { source_id: "..." })
 */
export async function deleteVectors(where) {
  try {
    const isOnline = await checkChroma();
    if (!isOnline) {
      console.warn('[ChromaDB] Offline. Skipping vector deletion.');
      return;
    }
    const collectionId = await getOrCreateCollection();
    await chromaRequest(`/collections/${collectionId}/delete`, 'POST', {
      where,
    });
  } catch (err) {
    console.error('[ChromaDB] Delete failed:', err);
    // Do not throw to prevent SQLite transaction rollback if ChromaDB is buggy during deleting
  }
}
