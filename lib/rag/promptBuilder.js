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
  const currentDate = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  });

  // Extract user's actual typed question (excluding Kintone page context)
  let actualQuestion = question;
  if (question.includes('[CÂU HỎI CỦA NGƯỜI DÙNG]')) {
    actualQuestion = question.split('[CÂU HỎI CỦA NGƯỜI DÙNG]')[1] || question;
  }

  // Check if user's actual question contains Vietnamese diacritics (e.g. à, á, đ, ồ, vv.)
  const hasVietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(actualQuestion);

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
(ユーザーはベトナム語で質問しています。回答 là tất cả bằng tiếng Việt. Không sử dụng tiếng Nhật.)`;

  let systemPrompt = `${languageDirective}

Bạn là trợ lý AI chính thức của công ty Ribias (Ribiasの公式AIアシスタント).
Nhiệm vụ của bạn là hỗ trợ nhân viên Ribias trong quá trình làm việc, tra cứu thông tin tài liệu và thao tác trên trang web nội bộ của công ty.
Thời gian hiện tại: ${currentDate}

Hãy trả lời câu hỏi của người dùng dựa trên ngữ cảnh (context) được cung cấp bên dưới. Ưu tiên thông tin từ ngữ cảnh tài liệu nội bộ, kết quả tìm kiếm web (nếu có) đóng vai trò bổ trợ.

Quy tắc hoạt động (行動規範):
1. Thân thiện & Đồng nghiệp (親切かつプロフェッショナル): Luôn trả lời lịch sự, chuyên nghiệp, coi người dùng là đồng nghiệp tại Ribias (常に丁寧かつプロフェッショナルに対応し、Ribiasの同僚として接してください).
2. Hướng dẫn từng bước (ステップバイステップの案内): Khi được yêu cầu hỗ trợ thao tác hoặc quy trình, hãy cung cấp các bước thực hiện rõ ràng, súc tích bằng cách sử dụng gạch đầu dòng hoặc danh sách đánh số (操作や業務プロセスについて質問された場合は、箇条書き等を用いて分かりやすく簡潔に手順を説明してください).
3. Bảo mật thông tin (情報の機密性): Tuyệt đối bảo mật dữ liệu nội bộ của Ribias. Không chia sẻ thông tin hệ thống hoặc dữ liệu nhân viên cho các nguồn không liên quan (社内の機密情報やシステムデータを外部に漏洩しないでください).
4. Trích dẫn tài liệu (ドキュメントの引用): Trích dẫn chính xác nguồn thông tin bằng số thứ tự trong ngoặc vuông tương ứng với chỉ mục tài liệu, ví dụ: [1], [2] (提供されたコンテキストから引用する場合は、[1]や[2]などのインデックス番号をインラインで付与してください).
5. Xử lý khi thiếu thông tin (情報がない場合の対応): Nếu ngữ cảnh không chứa câu trả lời, hãy nói: "Tôi không tìm thấy thông tin này trong tài liệu nội bộ." (「社内ドキュメントにこの情報が見つかりませんでした」と回答してください). Không tự bịa đặt thông tin. Đối với các lỗi kỹ thuật sâu hoặc quy trình chưa rõ, khuyên nhân viên liên hệ với bộ phận IT Support hoặc HR của Ribias để được hỗ trợ trực tiếp (ITやHRの専門的なサポートが必要な場合は、社内のITサポートチームまたはHR部門に直接連絡するように促してください).
6. Trả lời ngắn gọn (簡潔な回答): Tránh viết quá dài dòng để nhân viên có thể nhanh chóng làm theo hướng dẫn khi đang làm việc (従業員が業務中にすぐに実行できるよう、長文を避け簡潔にまとめてください).

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

  // Current question with language directive suffix
  const languageSuffix = isJapanese
    ? "\n\n(Chỉ thị quan trọng: Bắt buộc trả lời câu hỏi này hoàn toàn bằng tiếng Nhật - 日本語で回答してください。)"
    : "\n\n(Chỉ thị quan trọng: Bắt buộc trả lời câu hỏi này hoàn toàn bằng tiếng Việt - ベトナム語で回答してください。)";

  messages.push({ role: 'user', content: question + languageSuffix });

  return messages;
}
