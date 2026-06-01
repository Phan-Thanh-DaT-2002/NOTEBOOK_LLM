import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/connection.js';
import { retrieveContext } from '@/lib/rag/retriever.js';
import { buildPrompt } from '@/lib/rag/promptBuilder.js';
import { getChatStream } from '@/lib/providers/chat-stream.js';
import { searchWeb } from '@/lib/search/web-search.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { notebookId, question, webSearchEnabled } = body;

    if (!question) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'question is required' }
      }, { status: 400 });
    }

    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('global');
    
    let activeSettings = settings;
    let notebook = null;

    if (notebookId) {
      notebook = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(notebookId);
      if (!notebook) {
        return NextResponse.json({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Notebook not found' }
        }, { status: 404 });
      }

      activeSettings = {
        ...settings,
        chat_model: notebook.chat_model || settings.chat_model
      };
    }

    // 2. Perform Web Search if enabled
    let webResults = [];
    if (webSearchEnabled) {
      try {
        let searchQuery = question;
        const prefixToRemove = [
          /^(tra cứu internet xem|tra cứu mạng xem|tra cứu mạng|tra cứu internet|tìm kiếm mạng|tìm trên mạng|tìm kiếm trên mạng|hãy tìm kiếm trên mạng|hãy tìm trên mạng|tìm google|search google|search internet|google search)\s+/i,
          /^(hãy cho biết|cho tôi biết|cho hỏi|hỏi xem|xem|tìm|search for|find info about|lookup|look up)\s+/i
        ];
        for (const regex of prefixToRemove) {
          searchQuery = searchQuery.replace(regex, '');
        }
        searchQuery = searchQuery.trim();

        console.log(`[Chat Stream] Performing Web Search for: "${searchQuery}" (Original: "${question}")`);
        webResults = await searchWeb(searchQuery, 5);
      } catch (err) {
        console.error('[Chat Stream] Web Search failed:', err);
      }
    }

    let promptMessages;
    let context = [];

    if (notebookId) {
      // 2.5. Retrieve semantic context chunks
      context = await retrieveContext(question, notebookId);

      // 3. Fetch past conversations history
      const history = db.prepare(`
        SELECT role, content FROM chat_messages 
        WHERE notebook_id = ? 
        ORDER BY created_at ASC 
        LIMIT 20
      `).all(notebookId);

      // 4. Build messages prompt array with hybrid context
      promptMessages = buildPrompt(question, context, history, notebook, webResults);
    } else {
      // General Q&A: parse conversation history from request body if available
      const requestHistory = body.history || [];
      
      // Extract user's actual typed question (excluding Kintone page context)
      let actualQuestion = question;
      if (question.includes('[CÂU HỎI CỦA NGƯỜI DÙNG]')) {
        actualQuestion = question.split('[CÂU HỎI CỦA NGƯỜI DÙNG]')[1] || question;
      }

      // Check if user's actual question contains Vietnamese diacritics (e.g. à, á, đ, ồ, vv.)
      const hasVietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(actualQuestion);

      // Check if user's actual question contains Japanese characters (Hiragana, Katakana, Kanji)
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(actualQuestion);
      
      // If the query contains Japanese but ALSO contains Vietnamese diacritics, it means they are quoting Japanese inside a Vietnamese query.
      const isJapanese = hasJapanese && !hasVietnameseDiacritics;

      const languageDirective = isJapanese
        ? `[CRITICAL LANGUAGE RULE]
The user is asking in Japanese. You MUST reply and write your response completely in Japanese (日本語). Do not use Vietnamese for the answer.
(ユーザーは日本語で質問しています。回答はすべて日本語で記述してください。ベトナム語は使用しないでください。)`
        : `[CRITICAL LANGUAGE RULE]
The user is asking in Vietnamese. You MUST reply and write your response completely in Vietnamese (tiếng Việt). Do not use Japanese for the answer.
(ユーザーはベトナム語で質問しています。回答はすべてベトナム語で記述してください。日本語は使用しないでください。)`;

      const systemPrompt = `${languageDirective}

Bạn là trợ lý AI chính thức của công ty Ribias (Ribiasの公式AIアシスタント).
Nhiệm vụ của bạn là hỗ trợ nhân viên Ribias trong quá trình làm việc và thao tác trên trang web nội bộ của công ty.

Quy tắc hoạt động (行動規範):
1. Thân thiện & Đồng nghiệp (親切かつプロフェッショナル): Luôn trả lời lịch sự, chuyên nghiệp, coi người dùng là đồng nghiệp tại Ribias (常に丁寧かつプロフェッショナルに対応し、Ribiasの同僚として接してください).
2. Hướng dẫn từng bước (ステップバイステップの案内): Khi được yêu cầu hỗ trợ thao tác hoặc quy trình, hãy cung cấp các bước thực hiện rõ ràng, súc tích bằng cách sử dụng gạch đầu dòng hoặc danh sách đánh số (操作や業務プロセスについて質問された場合は、箇条書き等を用いて分かりやすく簡潔に手順を説明してください).
3. Bảo mật thông tin (情報の機密性): Tuyệt đối giữ bí mật các thông tin nội bộ của Ribias. Không chia sẻ dữ liệu hệ thống hoặc thông tin nhân viên ra bên ngoài (社内の機密情報やシステムデータを外部に漏洩しないでください).
4. Xử lý khi không rõ thông tin (不明な場合の対応): Đối với các quy trình phức tạp hoặc sự cố kỹ thuật sâu mà bạn không có đủ thông tin, hãy hướng dẫn nhân viên liên hệ với bộ phận IT Support hoặc HR của Ribias để được hỗ trợ trực tiếp (システムエラーや情報が不足している業務については、社内のITサポートまたはHR部門に直接問い合わせるよう案内してください).
5. Trả lời ngắn gọn (簡潔な回答): Tránh viết quá dài dòng để nhân viên có thể nhanh chóng làm theo hướng dẫn khi đang làm việc (従業員が業務中にすぐに実行できるよう、長文 câu chữ rườm ràを避け簡潔にまとめてください).`;

      const languageSuffix = isJapanese
        ? "\n\n(Chỉ thị quan trọng: Bắt buộc trả lời câu hỏi này hoàn toàn bằng tiếng Nhật - 日本語で回答してください。)"
        : "\n\n(Chỉ thị quan trọng: Bắt buộc trả lời câu hỏi này hoàn toàn bằng tiếng Việt - ベトナム語で回答してください。)";

      promptMessages = [
        { role: 'system', content: systemPrompt },
        ...requestHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: question + languageSuffix }
      ];
    }

    // 5. Establish streaming completions
    const llmStream = await getChatStream(promptMessages, activeSettings);
    const llmReader = llmStream.getReader();

    // 6. Return response stream using TransformStream for real-time flushing
    //    Key insight: ReadableStream's start() callback buffers internally on Next.js dev server.
    //    TransformStream + async IIFE writing to writable side ensures each chunk flushes immediately.
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Kick off async streaming in background — do NOT await this
    (async () => {
      let fullAnswer = '';

      try {
        // If web search enabled, send web_sources SSE event first
        if (webSearchEnabled && webResults.length > 0) {
          await writer.write(
            encoder.encode(`event: web_sources\ndata: ${JSON.stringify(webResults)}\n\n`)
          );
        }

        while (true) {
          const { done, value } = await llmReader.read();
          if (done) break;

          fullAnswer += value;
          
          // Stream token SSE event — writer.write() flushes immediately
          await writer.write(
            encoder.encode(`event: token\ndata: ${JSON.stringify({ text: value })}\n\n`)
          );
        }

        if (notebookId) {
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
          await writer.write(
            encoder.encode(`event: citations\ndata: ${JSON.stringify(citationsList)}\n\n`)
          );

          // Send done SSE event
          await writer.write(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ messageId: assistantMsgId })}\n\n`)
          );
        } else {
          // Send done SSE event for General Q&A
          await writer.write(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ messageId: crypto.randomUUID() })}\n\n`)
          );
        }

      } catch (streamErr) {
        console.error('[Chat Stream Route] Stream loop failed:', streamErr);
        try {
          await writer.write(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: streamErr.message })}\n\n`)
          );
        } catch (e) {
          // ignore
        }
      } finally {
        try {
          await writer.close();
        } catch (e) {
          // ignore
        }
      }
    })();

    // Return the readable side immediately — chunks flush as writer.write() is called
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'none',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
