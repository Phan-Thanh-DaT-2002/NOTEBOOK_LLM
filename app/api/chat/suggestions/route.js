import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import { generateCompletion } from '@/lib/providers/llm.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get('notebookId');

    if (!notebookId) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId parameter is required' }
      }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch a snippet of the first few sources to generate context-specific suggestions
    const sources = db.prepare(`
      SELECT raw_text FROM sources 
      WHERE notebook_id = ? AND sync_status = 'ready' AND enabled = 1
      LIMIT 2
    `).all(notebookId);

    const defaultSuggestions = [
      "Làm cách nào để tải tài liệu nghiên cứu lên đây?",
      "Tôi có thể hỏi những loại câu hỏi nào về nguồn tài liệu?",
      "Hướng dẫn sử dụng công cụ học tập Studio?"
    ];

    if (sources.length === 0) {
      return NextResponse.json({ ok: true, data: defaultSuggestions });
    }

    const combinedSnippet = sources.map(s => s.raw_text?.substring(0, 1500)).join('\n\n');
    if (!combinedSnippet.trim()) {
      return NextResponse.json({ ok: true, data: defaultSuggestions });
    }

    try {
      const systemPrompt = `You are a research assistant. Based on the provided context snippets of document sources, generate exactly 3 distinct, short, high-value questions (under 15 words each) that a student or researcher would want to ask about these documents.
Return the output ONLY as a raw valid JSON string array of strings, for example:
["Câu hỏi 1", "Câu hỏi 2", "Câu hỏi 3"]
Do not add any explanation, prefix, or markdown wrapping. Ensure output is in the language of the source text.`;
      
      const userPrompt = `Document Snippets:\n\n${combinedSnippet}`;
      const llmResult = await generateCompletion(systemPrompt, userPrompt);
      
      // Clean result if markdown is returned by mistake
      let cleanedJson = llmResult.trim();
      if (cleanedJson.startsWith('```')) {
        cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const questions = JSON.parse(cleanedJson);
      if (Array.isArray(questions) && questions.length > 0) {
        return NextResponse.json({ ok: true, data: questions.slice(0, 3) });
      }
    } catch (parseErr) {
      console.warn('[Suggestions API] LLM JSON generation failed, falling back to defaults:', parseErr);
    }

    return NextResponse.json({ ok: true, data: defaultSuggestions });
  } catch (err) {
    console.error('[Suggestions API] GET error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
