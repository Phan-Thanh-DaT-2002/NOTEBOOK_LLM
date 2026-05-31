-- Notebooks
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Notebook',
  chat_model TEXT,
  embedding_model TEXT,
  custom_instructions TEXT,
  chat_style TEXT DEFAULT 'default',
  response_length TEXT DEFAULT 'default',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sources
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  content_hash TEXT,
  language TEXT,
  original_url TEXT,
  file_path TEXT,
  raw_text TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'pending',
  reembed_required INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Source Versions
CREATE TABLE IF NOT EXISTS source_versions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  parser_version TEXT,
  embedding_model TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Source Labels
CREATE TABLE IF NOT EXISTS source_labels (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6c5ce7'
);

CREATE TABLE IF NOT EXISTS source_label_map (
  source_id TEXT REFERENCES sources(id) ON DELETE CASCADE,
  label_id TEXT REFERENCES source_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, label_id)
);

-- Chunks
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_version_id TEXT REFERENCES source_versions(id),
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

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Citations
CREATE TABLE IF NOT EXISTS citations (
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

-- Notes
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('written','saved')),
  pinned INTEGER DEFAULT 0,
  source_message_id TEXT REFERENCES chat_messages(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','generating','ready','error')),
  prompt TEXT,
  config_json TEXT,
  output_markdown TEXT,
  file_url TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artifact Items
CREATE TABLE IF NOT EXISTS artifact_items (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Embedding Jobs
CREATE TABLE IF NOT EXISTS embedding_jobs (
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

-- Study Progress
CREATE TABLE IF NOT EXISTS study_progress (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES artifact_items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'unseen' CHECK(status IN ('unseen','correct','incorrect','skipped')),
  score REAL,
  attempts INTEGER DEFAULT 0,
  last_seen_at DATETIME
);

-- Settings (Global, single row)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  provider TEXT DEFAULT 'ollama',
  api_key_encrypted TEXT,
  ollama_url TEXT DEFAULT 'http://localhost:11434',
  chat_model TEXT DEFAULT 'qwen2.5:7b',
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  tts_provider TEXT DEFAULT 'browser',
  theme TEXT DEFAULT 'dark'
);

-- Model Calls
CREATE TABLE IF NOT EXISTS model_calls (
  id TEXT PRIMARY KEY,
  notebook_id TEXT,
  provider TEXT,
  model TEXT,
  purpose TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  cost_estimate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed global settings if not exists
INSERT OR IGNORE INTO settings (id, provider, ollama_url, chat_model, embedding_model, tts_provider, theme)
VALUES ('global', 'ollama', 'http://localhost:11434', 'qwen2.5:7b', 'nomic-embed-text', 'browser', 'dark');
