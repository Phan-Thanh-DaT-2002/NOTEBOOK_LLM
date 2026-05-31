/**
 * Builds the prompt messages array for LLM ingestion
 * @param {string} question Current question
 * @param {Array<object>} context Retrieved chunks
 * @param {Array<object>} history Message history [{ role, content }]
 * @param {object} notebook Notebook settings (custom instructions)
 * @param {Array<object>} webResults Web search results
 * @returns {Array<object>} Array of messages [{ role, content }]
 */
export function buildPrompt(question, context, history = [], notebook = {}, webResults = []) {
  // 1. Build context blocks
  let contextText = '';
  if (context.length === 0) {
    contextText = 'No local document context available.';
  } else {
    contextText = context.map((c, idx) => {
      const pageInfo = c.page_number ? `, Page ${c.page_number}` : '';
      return `[${idx + 1}] (Source: ${c.filename}${pageInfo}):\n"${c.content}"`;
    }).join('\n\n');
  }

  // 1.5. Build web search context blocks if present
  let webText = '';
  if (webResults && webResults.length > 0) {
    webText = '\n\nWeb Search Results:\n' + webResults.map((r, idx) => {
      return `[Web Result ${idx + 1}] (Title: ${r.title}, Link: ${r.url}):\n"${r.snippet}"`;
    }).join('\n\n');
  }

  // 2. Build system instructions
  let systemPrompt = `You are a research assistant inside a self-hosted NotebookLM-like application.
Answer the user's question using the provided context. Priority should be given to local source context, with web search results serving as complementary current information if needed.

Rules:
1. Cite local source facts using numbered brackets matching their source index, e.g. [1], [2].
2. Cite web search facts using the format [Web Result X] matching their link index, e.g. [Web Result 1].
3. Place citations inline immediately following the statements they support.
4. If the context (both local and web) does not contain the answer, say: "I cannot find this information in the provided sources." Do not make up answers.
5. Answer in the same language as the user's question.

Source Context:
${contextText}${webText}`;

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
