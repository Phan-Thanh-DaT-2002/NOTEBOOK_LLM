import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/connection.js';
import { retrieveContext } from '@/lib/rag/retriever.js';
import { buildPrompt } from '@/lib/rag/promptBuilder.js';
import { getChatStream } from '@/lib/providers/chat-stream.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { notebookId, question } = body;

    if (!notebookId || !question) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId and question are required' }
      }, { status: 400 });
    }

    const db = getDb();

    // 1. Fetch Notebook and Settings details
    const notebook = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(notebookId);
    if (!notebook) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Notebook not found' }
      }, { status: 404 });
    }

    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');

    // Override settings with notebook configurations if set
    const activeSettings = {
      ...settings,
      chat_model: notebook.chat_model || settings.chat_model
    };

    // 2. Retrieve semantic context chunks
    const context = await retrieveContext(question, notebookId);

    // 3. Fetch past conversations history
    const history = db.prepare(`
      SELECT role, content FROM chat_messages 
      WHERE notebook_id = ? 
      ORDER BY created_at ASC 
      LIMIT 20
    `).all(notebookId);

    // 4. Build messages prompt array
    const promptMessages = buildPrompt(question, context, history, notebook);

    // 5. Establish streaming completions
    const llmStream = await getChatStream(promptMessages, activeSettings);
    const reader = llmStream.getReader();

    // 6. Return response stream using Server-Sent Events (SSE)
    const encoder = new TextEncoder();
    
    const responseStream = new ReadableStream({
      async start(controller) {
        let fullAnswer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fullAnswer += value;
            
            // Stream token SSE event
            controller.enqueue(
              encoder.encode(`event: token\ndata: ${JSON.stringify({ text: value })}\n\n`)
            );
          }

          // Ingestion completion: Save messages into database
          const userMsgId = crypto.randomUUID();
          const assistantMsgId = crypto.randomUUID();

          db.transaction(() => {
            // Save User Message
            db.prepare(`
              INSERT INTO chat_messages (id, notebook_id, role, content)
              VALUES (?, ?, 'user', ?)
            `).run(userMsgId, notebookId, question);

            // Save Assistant Message
            db.prepare(`
              INSERT INTO chat_messages (id, notebook_id, role, content)
              VALUES (?, ?, 'assistant', ?)
            `).run(assistantMsgId, notebookId, fullAnswer);
          })();

          // Parse and record citations
          const citationRegex = /\[(\d+)\]/g;
          const citationsList = [];
          const seenIndices = new Set();
          let match;

          while ((match = citationRegex.exec(fullAnswer)) !== null) {
            const index = parseInt(match[1], 10);
            if (index > 0 && index <= context.length) {
              const chunk = context[index - 1];
              const citationId = crypto.randomUUID();
              
              const key = `${chunk.id}_${index}`;
              if (!seenIndices.has(key)) {
                seenIndices.add(key);

                const citationObj = {
                  id: citationId,
                  message_id: assistantMsgId,
                  source_id: chunk.source_id,
                  chunk_id: chunk.id,
                  citation_index: index,
                  quote: chunk.content.substring(0, 180),
                  page_number: chunk.page_number,
                  char_start: chunk.char_start,
                  char_end: chunk.char_end,
                  filename: chunk.filename // for UI convenience
                };

                // Save to DB
                db.prepare(`
                  INSERT INTO citations (id, message_id, source_id, chunk_id, citation_index, quote, page_number, char_start, char_end)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  citationId,
                  assistantMsgId,
                  chunk.source_id,
                  chunk.id,
                  index,
                  citationObj.quote,
                  chunk.page_number,
                  chunk.char_start,
                  chunk.char_end
                );

                citationsList.push(citationObj);
              }
            }
          }

          // Send citations SSE event
          controller.enqueue(
            encoder.encode(`event: citations\ndata: ${JSON.stringify(citationsList)}\n\n`)
          );

          // Send done SSE event
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ messageId: assistantMsgId })}\n\n`)
          );

          controller.close();
        } catch (streamErr) {
          console.error('[Chat Stream Route] Stream loop failed:', streamErr);
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: streamErr.message })}\n\n`)
          );
          controller.close();
        }
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (err) {
    console.error('[Chat Stream Route] Error:', err);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    }, { status: 500 });
  }
}
