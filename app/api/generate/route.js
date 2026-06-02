import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/connection.js';
import { generateCompletion } from '@/lib/providers/llm.js';
import { cleanAIText } from '@/lib/utils.js';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { notebookId, type } = body;

    if (!notebookId || !type) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'notebookId and type are required fields.' }
      }, { status: 400 });
    }

    if (!['briefing_doc', 'study_guide', 'faq', 'timeline', 'flashcards', 'quiz', 'mind_map'].includes(type)) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid artifact type. Must be briefing_doc, study_guide, faq, timeline, flashcards, quiz, or mind_map.' }
      }, { status: 400 });
    }

    const db = getDb();
    
    // Check if notebook exists
    const notebook = db.prepare('SELECT id FROM notebooks WHERE id = ?').get(notebookId);
    if (!notebook) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Notebook not found.' }
      }, { status: 404 });
    }

    // Check if there are any active enabled sources
    const activeSourcesCount = db.prepare(`
      SELECT COUNT(*) as count FROM sources 
      WHERE notebook_id = ? AND enabled = 1 AND sync_status = 'ready'
    `).get(notebookId);

    if (!activeSourcesCount || activeSourcesCount.count === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Không tìm thấy nguồn tài liệu nào được kích hoạt. Hãy bật ít nhất 1 tài liệu nguồn trước khi sinh tài liệu học tập.' }
      }, { status: 400 });
    }

    const artifactId = crypto.randomUUID();
    const titleMap = {
      briefing_doc: 'Briefing Document',
      study_guide: 'Study Guide',
      faq: 'FAQ Document',
      timeline: 'Timeline Chronology',
      flashcards: 'Flashcards Deck',
      quiz: 'Study Quiz',
      mind_map: 'Interactive Mind Map'
    };
    const title = titleMap[type] || 'Generated Document';

    db.prepare(`
      INSERT INTO artifacts (id, notebook_id, type, title, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(artifactId, notebookId, type, title);

    // Run the generation asynchronously without blocking the response
    generateArtifactInBackground(artifactId, notebookId, type).catch(err => {
      console.error(`[Background Artifact Gen] Uncaught error for ${artifactId}:`, err);
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: artifactId,
        status: 'pending',
        title
      }
    });
  } catch (error) {
    console.error('[Generate API] POST failed:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    }, { status: 500 });
  }
}

async function generateArtifactInBackground(artifactId, notebookId, type) {
  const db = getDb();
  
  // Transition to 'generating'
  db.prepare('UPDATE artifacts SET status = ? WHERE id = ?').run('generating', artifactId);

  try {
    // 1. Gather all active sources
    const sources = db.prepare(`
      SELECT filename, raw_text FROM sources 
      WHERE notebook_id = ? AND enabled = 1 AND sync_status = 'ready'
    `).all(notebookId);

    if (sources.length === 0) {
      throw new Error('Không có tài liệu nguồn nào hoạt động.');
    }

    // Combine raw texts
    const combinedContent = sources.map(s => `Tên tài liệu: ${s.filename}\nNội dung:\n${s.raw_text}`).join('\n\n=========================\n\n');
    // 2. Build system prompt
    let systemPrompt = '';
    
    if (type === 'briefing_doc') {
      systemPrompt = `Bạn là một chuyên gia phân tích thông tin.
Hãy tạo một "Briefing Document" (Tài liệu Tóm tắt) chất lượng cao bằng Markdown tiếng Việt dựa trên tài liệu nguồn được cung cấp.
Yêu cầu:
- Tóm tắt súc tích các chủ đề chính, luận điểm quan trọng và thông tin nền tảng.
- Sử dụng các tiêu đề, danh sách, và bảng để thông tin dễ đọc.
- Bám sát chính xác dữ liệu nguồn, không tự ý thêm các thông tin chưa được kiểm chứng từ bên ngoài.`;
    } else if (type === 'study_guide') {
      systemPrompt = `Bạn là một giáo sư sư phạm.
Hãy xây dựng một "Đề cương Học tập" (Study Guide) chi tiết bằng Markdown tiếng Việt từ tài liệu nguồn.
Yêu cầu:
- Mục 1: Các chủ đề then chốt (Key Themes) kèm tóm tắt nội dung học tập.
- Mục 2: Danh sách thuật ngữ quan trọng (Key Terms) kèm định nghĩa rõ ràng.
- Mục 3: Bộ câu hỏi thảo luận tự học (Discussion Questions) giúp người học ôn tập kiến thức sâu hơn.
- Không bịa đặt thông tin ngoài tài liệu nguồn.`;
    } else if (type === 'faq') {
      systemPrompt = `Hãy biên soạn danh sách khoảng 8 đến 10 câu hỏi thường gặp (FAQs) và lời giải đáp chi tiết nhất dựa trên tài liệu nguồn được cung cấp.
Yêu cầu:
- Trình bày dưới dạng câu hỏi - trả lời Markdown bằng tiếng Việt rõ ràng.
- Các câu hỏi phải xoay quanh các khái niệm quan trọng, khó hiểu hoặc cốt lõi nhất của tài liệu.
- Câu trả lời cụ thể, đi thẳng vào vấn đề và tuyệt đối chính xác với tài liệu gốc.`;
    } else if (type === 'timeline') {
      systemPrompt = `Bạn là một nhà sử học biên niên. Hãy lập một "Bảng Niên biểu Lịch sử / Tiến trình" (Timeline) chi tiết bằng tiếng Việt dựa theo các sự kiện và thời gian tìm thấy trong tài liệu nguồn.
Yêu cầu:
- Phải trả về dữ liệu ở định dạng JSON thô duy nhất biểu diễn một mảng các đối tượng sự kiện.
- Định dạng trả về bắt buộc tuân thủ cấu trúc sau:
[
  {
    "date": "Thời gian (ví dụ: Khoảng năm 257 TCN hoặc 1945)",
    "event": "Sự kiện (ví dụ: Thành lập nước Âu Lạc)",
    "detail": "Chi tiết / Ý nghĩa sự kiện"
  }
]
Lưu ý: Không viết bất kỳ lời dẫn nhập, hướng dẫn, hay giải thích nào ngoài chuỗi JSON hợp lệ này. Hãy viết mã JSON trực tiếp.`;
    } else if (type === 'mind_map') {
      systemPrompt = `Bạn là một chuyên gia bản đồ tư duy. Hãy tạo một bản đồ tư duy (mind map) chi tiết từ tài liệu nguồn được cung cấp.
Yêu cầu:
- Phải trả về dữ liệu ở định dạng JSON thô duy nhất biểu diễn một cấu trúc cây phân cấp (hierarchy tree) hoàn chỉnh của mindmap bằng tiếng Việt.
- Định dạng trả về bắt buộc tuân thủ cấu trúc sau:
{
  "name": "Chủ đề chính",
  "children": [
    {
      "name": "Ý chính 1",
      "children": [
        { "name": "Ý chi tiết 1.1" },
        { "name": "Ý chi tiết 1.2" }
      ]
    },
    {
      "name": "Ý chính 2",
      "children": [
        { "name": "Ý chi tiết 2.1" }
      ]
    }
  ]
}
Lưu ý: Không viết bất kỳ lời dẫn nhập, hướng dẫn, hay giải thích nào ngoài chuỗi JSON hợp lệ này. Hãy viết mã JSON trực tiếp.`;
    } else if (type === 'flashcards') {
      systemPrompt = `Bạn là một trợ lý học tập. Hãy tạo bộ thẻ ghi nhớ (flashcards) giúp học tập từ tài liệu nguồn.
Yêu cầu:
- Phải trả về dữ liệu ở định dạng JSON thô (một mảng các đối tượng chứa "front" - câu hỏi/khái niệm ở mặt trước và "back" - câu trả lời ở mặt sau) bằng tiếng Việt.
- Ví dụ định dạng trả về:
[
  {"front": "Mốc thời gian thành lập nước Âu Lạc?", "back": "Khoảng năm 257 TCN"}
]
Lưu ý: Không viết bất kỳ lời dẫn nhập, hướng dẫn, hay kết luận nào ngoài chuỗi JSON hợp lệ này. Hãy viết mã JSON trực tiếp.`;
    } else if (type === 'quiz') {
      systemPrompt = `Bạn là một giảng viên ra đề thi chuyên nghiệp. Hãy tạo một bộ câu hỏi trắc nghiệm ôn tập gồm từ 5 đến 8 câu hỏi dựa trên tài liệu nguồn.
Yêu cầu:
- Phải trả về dữ liệu ở định dạng JSON thô (một mảng các đối tượng chứa "question" - câu hỏi, "options" - mảng gồm 4 lựa chọn trả lời, "answerIndex" - số nguyên từ 0 đến 3 biểu diễn vị trí đáp án đúng trong mảng options, và "explanation" - lời giải thích ngắn gọn lý do chọn đáp án này) bằng tiếng Việt.
- Ví dụ định dạng trả về:
[
  {
    "question": "Ai là người lập ra nước Văn Lang?",
    "options": ["Hùng Vương", "An Dương Vương", "Lý Nam Đế", "Ngô Quyền"],
    "answerIndex": 0,
    "explanation": "Hùng Vương là người sáng lập ra nhà nước Văn Lang trong truyền thuyết."
  }
]
Lưu ý: Không viết bất kỳ lời dẫn nhập hay kết luận nào ngoài chuỗi JSON hợp lệ này. Hãy viết mã JSON trực tiếp.`;
    }

    const userPrompt = `Dưới đây là các tài liệu nguồn làm căn cứ:\n\n${combinedContent}\n\nHãy tạo tài liệu học tập phù hợp theo đúng các yêu cầu và tài liệu nguồn phía trên:`;

    const output = await generateCompletion(systemPrompt, userPrompt);

    // Save to DB
    if (type === 'flashcards' || type === 'quiz') {
      let cleanJson = output.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      }
      
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(cleanJson);
        if (!Array.isArray(parsedItems)) {
          throw new Error('LLM output is not a valid JSON array');
        }
      } catch (parseErr) {
        console.error('JSON parsing failed on LLM output:', output);
        throw new Error('LLM không trả về đúng cấu trúc dữ liệu ôn tập yêu cầu. Hãy thử lại.');
      }

      // Clean string fields in flashcards/quiz
      const cleanedItems = parsedItems.map(item => {
        if (type === 'flashcards') {
          return {
            front: cleanAIText(item.front),
            back: cleanAIText(item.back)
          };
        } else if (type === 'quiz') {
          return {
            question: cleanAIText(item.question),
            options: Array.isArray(item.options) ? item.options.map(opt => cleanAIText(opt)) : [],
            answerIndex: typeof item.answerIndex === 'number' ? item.answerIndex : 0,
            explanation: cleanAIText(item.explanation)
          };
        }
        return item;
      });

      const insertStmt = db.prepare(`
        INSERT INTO artifact_items (id, artifact_id, item_type, content_json, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const insertTransaction = db.transaction((items) => {
        items.forEach((item, index) => {
          const itemId = crypto.randomUUID();
          const itemType = type === 'flashcards' ? 'flashcard' : 'quiz_question';
          insertStmt.run(itemId, artifactId, itemType, JSON.stringify(item), index);
        });
      });
      
      insertTransaction(cleanedItems);

      let previewMd = '';
      if (type === 'flashcards') {
        previewMd = `### Bộ thẻ ghi nhớ Flashcards (${cleanedItems.length} thẻ)\n\n` + 
          cleanedItems.map((item, idx) => `**Thẻ ${idx + 1}**\n- Mặt trước: ${item.front}\n- Mặt sau: ${item.back}`).join('\n\n');
      } else {
        previewMd = `### Bài trắc nghiệm Quiz (${cleanedItems.length} câu hỏi)\n\n` +
          cleanedItems.map((item, idx) => `**Câu hỏi ${idx + 1}: ${item.question}**\n` + 
            item.options.map((opt, oIdx) => `- ${oIdx === item.answerIndex ? '[x]' : '[ ]'} ${opt}`).join('\n') + 
            `\n*Giải thích:* ${item.explanation}`).join('\n\n');
      }

      db.prepare(`
        UPDATE artifacts 
        SET status = 'ready', output_markdown = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(previewMd, artifactId);
    } else {
      let cleanOutput = output.trim();
      if ((type === 'mind_map' || type === 'timeline') && cleanOutput.startsWith('```')) {
        cleanOutput = cleanOutput.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      }
      if (type === 'briefing_doc' || type === 'study_guide' || type === 'faq') {
        cleanOutput = cleanAIText(cleanOutput);
      }
      db.prepare(`
        UPDATE artifacts 
        SET status = 'ready', output_markdown = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanOutput, artifactId);
    }
  } catch (error) {
    
    db.prepare(`
      UPDATE artifacts 
      SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(error.message || 'Lỗi không xác định trong quá trình sinh dữ liệu.', artifactId);
  }
}
