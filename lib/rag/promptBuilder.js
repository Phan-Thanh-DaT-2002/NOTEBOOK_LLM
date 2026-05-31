/**
 * Builds the prompt messages array for LLM ingestion
 * @param {string} question Current question
 * @param {Array<object>} context Retrieved chunks
 * @param {Array<object>} history Message history [{ role, content }]
 * @param {object} notebook Notebook settings (custom instructions)
 * @returns {Array<object>} Array of messages [{ role, content }]
 */
export function buildPrompt(question, context, history = [], notebook = {}) {
  // 1. Build context blocks
  let contextText = '';
  if (context.length === 0) {
    contextText = 'No document context available. Inform the user that you could not find any source documents enabled.';
  } else {
    contextText = context.map((c, idx) => {
      const pageInfo = c.page_number ? `, Page ${c.page_number}` : '';
      return `[${idx + 1}] (Source: ${c.filename}${pageInfo}):\n"${c.content}"`;
    }).join('\n\n');
  }

  // 2. Build system instructions
  let systemPrompt = `You are a research assistant inside a self-hosted NotebookLM-like application.
Answer the user's question ONLY using the provided source context below.

Rules:
1. Cite facts using numbered brackets matching the context source index, e.g. [1], [2].
2. Place citations inline immediately following the statements they support.
3. If the context does not contain the answer, say: "I cannot find this information in the provided sources." Do not make up answers outside the context.
4. Answer in the same language as the user's question.

Source Context:
${contextText}`;

  // 3. Append custom notebook guidelines if provided
  if (notebook.custom_instructions && notebook.custom_instructions.trim()) {
    systemPrompt += `\n\nAdditional User Instructions:\n${notebook.custom_instructions.trim()}`;
  }

  // 4. Assemble full conversational array
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Feed limited history (up to last 6 messages) to maintain context without overloading buffer
  const historySnippet = history.slice(-6);
  historySnippet.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  // Current question
  messages.push({ role: 'user', content: question });

  return messages;
}
