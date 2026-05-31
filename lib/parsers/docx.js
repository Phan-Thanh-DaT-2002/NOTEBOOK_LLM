import mammoth from 'mammoth';

/**
 * Extracts raw text from a DOCX buffer
 * @param {Buffer} buffer
 * @returns {Promise<{text: string}>}
 */
export async function parseDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value || '',
    };
  } catch (err) {
    console.error('DOCX parsing error:', err);
    throw new Error(`Failed to parse DOCX document: ${err.message}`);
  }
}
