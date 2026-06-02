/**
 * Cleans AI-generated text by resolving common formatting issues,
 * such as excessive blank lines, trailing whitespaces, and scattered bullet points.
 * @param {string} text
 * @returns {string}
 */
export function cleanAIText(text) {
  if (!text) return '';
  return text
    .replace(/\n{3,}/g, "\n\n")      // nhiều dòng trống -> tối đa 1 dòng
    .replace(/[ \t]+\n/g, "\n")      // xóa space cuối dòng
    .replace(/\n\s*\n\s*([•\-*]|\d+\.)/g, "\n$1")  // giảm khoảng trống trước bullet
    .trim();
}
