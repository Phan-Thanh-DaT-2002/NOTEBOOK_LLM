import { processSource } from './process-source.js';

// In-process concurrent job queue configurations
const pendingQueue = [];
let activeWorkers = 0;
const MAX_CONCURRENCY = 2;

/**
 * Process the next source in the queue
 */
async function processNext() {
  if (activeWorkers >= MAX_CONCURRENCY || pendingQueue.length === 0) {
    return;
  }

  const sourceId = pendingQueue.shift();
  activeWorkers++;

  try {
    console.log(`[JobQueue] Starting processing for source: ${sourceId}`);
    await processSource(sourceId);
    console.log(`[JobQueue] Finished processing for source: ${sourceId}`);
  } catch (err) {
    console.error(`[JobQueue] Worker failed processing source ${sourceId}:`, err);
  } finally {
    activeWorkers--;
    // Schedule next
    processNext();
  }
}

/**
 * Enqueues a source ingestion job
 * @param {string} sourceId
 */
export function enqueueSourceIngestion(sourceId) {
  if (!pendingQueue.includes(sourceId)) {
    pendingQueue.push(sourceId);
    console.log(`[JobQueue] Enqueued source: ${sourceId}. Queue length: ${pendingQueue.length}`);
    // Run worker loop asynchronously
    processNext();
  }
}
