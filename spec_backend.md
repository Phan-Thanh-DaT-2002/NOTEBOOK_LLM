# Local Notebook AI — Backend & Data Specification

## 1. Data Models (SQLite)

### Notebook
```sql
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Notebook',
  model_provider TEXT DEFAULT 'ollama',
  chat_model TEXT DEFAULT 'llama3',
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  custom_instructions TEXT,
  chat_style TEXT DEFAULT 'default',
  response_length TEXT DEFAULT 'default',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Source
```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  original_url TEXT,
  file_path TEXT,
  raw_text TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'ready',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### SourceLabel
```sql
CREATE TABLE source_labels (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6c5ce7'
);

CREATE TABLE source_label_map (
  source_id TEXT REFERENCES sources(id) ON DELETE CASCADE,
  label_id TEXT REFERENCES source_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, label_id)
);
```

### Chunk (Enhanced Citation Metadata)
```sql
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  slide_number INTEGER,
  timestamp_start REAL,
  char_start INTEGER,
  char_end INTEGER,
  heading_path TEXT,
  embedding_id TEXT,
  embedding_model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### ChatMessage
```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Citation
```sql
CREATE TABLE citations (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  citation_index INTEGER NOT NULL,
  quote TEXT,
  page_number INTEGER,
  char_start INTEGER,
  char_end INTEGER
);
```

### Note
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('written', 'saved')),
  pinned INTEGER DEFAULT 0,
  source_message_id TEXT REFERENCES chat_messages(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Artifact
```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','generating','ready','error')),
  prompt TEXT,
  config_json TEXT,
  output_json TEXT,
  output_markdown TEXT,
  file_url TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### EmbeddingJob
```sql
CREATE TABLE embedding_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','done','error')),
  embedding_model TEXT,
  total_chunks INTEGER DEFAULT 0,
  processed_chunks INTEGER DEFAULT 0,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME
);
```

### StudyProgress
```sql
CREATE TABLE study_progress (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('flashcard', 'quiz_question')),
  status TEXT DEFAULT 'unseen' CHECK(status IN ('unseen','correct','incorrect','skipped')),
  score REAL,
  attempts INTEGER DEFAULT 0,
  last_seen_at DATETIME
);
```

### Settings
```sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  provider TEXT DEFAULT 'ollama',
  api_key_encrypted TEXT,
  ollama_url TEXT DEFAULT 'http://localhost:11434',
  chat_model TEXT DEFAULT 'llama3',
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  tts_provider TEXT DEFAULT 'browser',
  theme TEXT DEFAULT 'dark'
);
```

---

## 2. API Routes

### Notebooks
```
POST   /api/notebooks              → Create notebook
GET    /api/notebooks              → List all notebooks
GET    /api/notebooks/:id          → Get notebook detail
PATCH  /api/notebooks/:id          → Update notebook
DELETE /api/notebooks/:id          → Delete notebook + cascade
```

### Sources
```
POST   /api/sources/upload         → Upload file (multipart)
POST   /api/sources/import         → Import URL/YouTube/paste text
GET    /api/sources?notebookId=    → List sources for notebook
GET    /api/sources/:id            → Get source detail + text
PATCH  /api/sources/:id            → Update (toggle enabled, rename)
DELETE /api/sources/:id            → Delete source + chunks + embeddings
POST   /api/sources/:id/resync     → Re-parse and re-embed
```

### Source Labels
```
POST   /api/labels                 → Create label
GET    /api/labels?notebookId=     → List labels
PATCH  /api/labels/:id             → Update label
DELETE /api/labels/:id             → Delete label
POST   /api/sources/:id/labels     → Assign labels to source
```

### Chat
```
POST   /api/chat/stream            → RAG chat (SSE streaming)
GET    /api/chat/history?notebookId= → Get chat history
DELETE /api/chat/history?notebookId= → Clear chat history
GET    /api/chat/suggestions?notebookId= → Get suggested questions
```

### Notes
```
POST   /api/notes                  → Create note
GET    /api/notes?notebookId=      → List notes
PATCH  /api/notes/:id              → Update note
DELETE /api/notes/:id              → Delete note
POST   /api/notes/:id/convert      → Convert note to source
POST   /api/notes/convert-all      → Convert all notes to source
```

### Artifacts / Generate
```
POST   /api/generate/study-guide   → Generate study guide
POST   /api/generate/faq           → Generate FAQ
POST   /api/generate/briefing      → Generate briefing doc
POST   /api/generate/timeline      → Generate timeline
POST   /api/generate/mind-map      → Generate mind map
POST   /api/generate/flashcards    → Generate flashcards
POST   /api/generate/quiz          → Generate quiz
POST   /api/generate/infographic   → Generate infographic (V2)
POST   /api/generate/slide-deck    → Generate slide deck (V2)

GET    /api/artifacts?notebookId=  → List artifacts
GET    /api/artifacts/:id          → Get artifact detail
DELETE /api/artifacts/:id          → Delete artifact
```

### Audio/Video
```
POST   /api/audio/overview         → Generate audio overview (V2)
GET    /api/audio/:id              → Get audio file
POST   /api/video/overview         → Generate video overview (V2)
```

### Study Progress
```
POST   /api/progress               → Record answer/attempt
GET    /api/progress?artifactId=   → Get progress for artifact
```

### Models & Settings
```
GET    /api/models                 → List available models from provider
GET    /api/settings               → Get current settings
POST   /api/settings               → Update settings
POST   /api/settings/test          → Test provider connection
```

---

## 3. Provider Abstraction

### Interfaces
```javascript
// lib/providers/llm.js
class LLMProvider {
  async generate(messages, options) → string
  async stream(messages, options) → ReadableStream
  async listModels() → string[]
}

// lib/providers/embedding.js  
class EmbeddingProvider {
  async embed(texts) → number[][]
  async embedSingle(text) → number[]
}

// lib/providers/tts.js
class TTSProvider {
  async synthesize(text, options) → ArrayBuffer
  listVoices() → Voice[]
}
```

### Provider Registry
```javascript
// lib/providers/registry.js
const providers = {
  ollama: { llm: OllamaLLM, embedding: OllamaEmbedding },
  openai: { llm: OpenAILLM, embedding: OpenAIEmbedding },
  gemini: { llm: GeminiLLM, embedding: GeminiEmbedding },
  anthropic: { llm: AnthropicLLM, embedding: null }, // uses other provider
};
```

### Ollama Config
- Base URL: `http://localhost:11434/v1/` (OpenAI-compatible)
- API Key: `"ollama"` (placeholder, ignored by Ollama)
- Model names match locally pulled models (e.g., `llama3`, `qwen3`)

---

## 4. RAG Pipeline Detail

### Chunking Strategy
```javascript
// lib/chunker.js
const config = {
  chunkSize: 800,        // tokens target
  chunkOverlap: 120,     // token overlap
  separators: ['\n## ', '\n### ', '\n\n', '\n', '. ', ' '],
  preserveHeadings: true, // keep heading context in each chunk
  includeMetadata: true,  // page_number, heading_path, char offsets
};
```

### Prompt Template (RAG)
```
System: You are a research assistant. Answer questions ONLY using the provided context.
Include citation numbers [1], [2], etc. for each claim.
If the context doesn't contain relevant information, say so.

Context:
[1] (Source: {filename}, Page: {page}): {chunk_content}
[2] (Source: {filename}, Page: {page}): {chunk_content}
...

User: {query}
```

### Citation Extraction
- Parse LLM response for `[N]` patterns
- Map each N → chunk_id → source_id + char_start + char_end
- Store in citations table
- Return citation metadata alongside message

---

## 5. File Storage

```
data/
├── uploads/          # Original uploaded files
│   └── {source_id}/
│       └── {filename}
├── chromadb/         # ChromaDB persistent data (Docker volume)
├── audio/            # Generated audio files
│   └── {artifact_id}.mp3
├── exports/          # Generated export files
└── database.sqlite   # SQLite database
```

---

## 6. Docker Compose

```yaml
version: '3.8'
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./data/chromadb:/chroma/chroma
    environment:
      - ANONYMIZED_TELEMETRY=FALSE

  # Optional: Ollama (if not installed locally)
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    profiles:
      - with-ollama

volumes:
  ollama_data:
```
