/**
 * Splits text into chunks based on character targets and boundary separators
 * @param {string} text
 * @param {number} chunkSize
 * @param {number} chunkOverlap
 * @returns {Array<{content: string, charStart: number, charEnd: number}>}
 */
export function splitText(text, chunkSize = 800, chunkOverlap = 120) {
  const chunks = [];
  let index = 0;

  while (index < text.length) {
    let end = Math.min(index + chunkSize, text.length);

    if (end < text.length) {
      // Look back to find a reasonable separator boundary
      const lookbackLength = Math.min(180, end - index);
      const lookback = text.substring(end - lookbackLength, end);

      const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ' ', ''];
      let bestSplit = -1;
      let matchedSep = '';

      for (const sep of separators) {
        if (!sep) continue;
        const lastIdx = lookback.lastIndexOf(sep);
        if (lastIdx !== -1) {
          bestSplit = lastIdx;
          matchedSep = sep;
          break;
        }
      }

      if (bestSplit !== -1) {
        // Adjust end to align to separator
        end = end - lookbackLength + bestSplit + matchedSep.length;
      }
    }

    const content = text.substring(index, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        charStart: index,
        charEnd: end,
      });
    }

    // Step index forward by chunkSize minus overlap
    const step = chunkSize - chunkOverlap;
    index = Math.max(end - chunkOverlap, index + 1);
  }

  return chunks;
}

/**
 * Main chunking function which splits a document into structured DB records
 * @param {string} rawText
 * @param {object} options { chunkSize, chunkOverlap, fileType }
 * @returns {Array<{content: string, chunk_index: number, page_number: number|null, char_start: number, char_end: number}>}
 */
export function chunkDocument(rawText, options = {}) {
  const { chunkSize = 800, chunkOverlap = 120, fileType = 'txt' } = options;
  const chunks = [];
  let globalChunkIndex = 0;

  if (fileType === 'pdf') {
    // pdf-parse embeds form feed characters '\f' between pages
    const pages = rawText.split(/\f/);
    
    pages.forEach((pageContent, pageIdx) => {
      const pageNum = pageIdx + 1;
      const pageChunks = splitText(pageContent, chunkSize, chunkOverlap);
      
      pageChunks.forEach(pc => {
        chunks.push({
          content: pc.content,
          chunk_index: globalChunkIndex++,
          page_number: pageNum,
          char_start: pc.charStart,
          char_end: pc.charEnd,
        });
      });
    });
  } else {
    // Web URL, DOCX, TXT, MD
    const docChunks = splitText(rawText, chunkSize, chunkOverlap);
    
    docChunks.forEach(dc => {
      chunks.push({
        content: dc.content,
        chunk_index: globalChunkIndex++,
        page_number: null,
        char_start: dc.charStart,
        char_end: dc.charEnd,
      });
    });
  }

  return chunks;
}
