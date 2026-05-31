import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

/**
 * Extracts raw text and page counts from a PDF buffer
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, pageCount: number}>}
 */
export async function parsePDF(buffer) {
  try {
    const data = await pdf(buffer);
    return {
      text: data.text || '',
      pageCount: data.numpages || 1,
    };
  } catch (err) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }
}
