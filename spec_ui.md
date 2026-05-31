# Local Notebook AI — UI Specification

## 1. Dashboard Page (`/`)

### Header
- Logo + App name "Local Notebook AI" (left)
- Settings gear icon (right)
- Theme toggle (dark/light)

### Toolbar
- **"+ New Notebook"** button — primary CTA, gradient accent
- **View Toggle**: Tile (grid) / List — icon buttons
- **Sort**: Dropdown — "Most Recent" | "Title A-Z" | "Title Z-A"
- **Search**: Filter notebooks by title

### Notebook Grid (Tile View)
- Cards: 3-4 per row, responsive
- Each card: gradient top border, title, source count badge, last modified date, 3-dot menu
- 3-dot menu: Rename, Duplicate, Delete
- Hover: subtle lift shadow + scale

### Notebook List (List View)  
- Row: title, source count, last modified, 3-dot menu
- Hover: row highlight

---

## 2. Notebook Workspace (`/notebook/[id]`)

### Layout
```
┌─[Header Bar]──────────────────────────────────────────────┐
│ ← Back │ Notebook Title (editable) │ Share │ Settings     │
├────────────┬──────────────────────────┬───────────────────┤
│  SOURCES   │         CHAT             │     STUDIO        │
│  (~280px)  │    (flex-grow-1)         │    (~320px)       │
│  resizable │                          │    resizable      │
│            │                          │                   │
│            │                          │                   │
│            │                          │                   │
└────────────┴──────────────────────────┴───────────────────┘
```

- Panels resizable via drag handle
- Each panel collapsible (toggle icon in header bar)
- Mobile: tab-based switching between panels

### 2.1 Sources Panel (Left)

#### Header
- "Sources" title + count badge (e.g., "Sources (5)")
- **"+ Add"** button → dropdown: Upload File, Paste URL, Paste Text, Import YouTube

#### Source Upload Modal
- Drag & drop zone (dashed border, icon)
- File browser button
- Supported formats listed
- Progress bar during upload + processing
- States: Uploading → Parsing → Chunking → Embedding → Done

#### Source List
- Each item:
  - File type icon (PDF📄, DOCX📝, URL🔗, YouTube▶️, TXT📃)
  - Filename (truncated)
  - Checkbox toggle (include/exclude from RAG)
  - Label badges (colored dots)
  - Status indicator (✅ ready, ⏳ processing, ❌ error)
  - 3-dot menu: View, Re-sync, Remove
- **Search bar** above list: filter sources by name
- **Label filter**: filter by label/category

#### Source Viewer (Overlay panel — slides over chat)
- **Header**: filename, file type badge, word count, close button
- **AI Summary**: collapsible section at top — auto-generated summary
- **Full Text**: scrollable, rendered content
- **Search within**: Ctrl+F style search
- **Highlight**: when citation clicked from chat, scroll to passage + yellow highlight with fade animation

### 2.2 Chat Panel (Center)

#### Welcome State (empty chat)
- Notebook title large
- "Ask about your sources" subtitle
- 3-4 **Suggested Question chips** (auto-generated from sources)
- Quick action buttons: "Summarize all sources", "Key topics", "Compare sources"

#### Message History
- Scrollable, newest at bottom
- **User message**: right-aligned, accent background, rounded
- **AI message**: left-aligned, subtle background
  - Markdown rendered (headings, lists, tables, code blocks)
  - **Inline citations**: `[1]` `[2]` as small pill badges
    - **Hover**: tooltip showing quote + source filename
    - **Click**: open source viewer, scroll to exact passage, highlight
  - **Action bar** (bottom of each AI message):
    - 📌 Save to Note
    - 📋 Copy
    - 👍👎 Feedback
    - 🔄 Regenerate

#### Chat Input Area
- **Configure Chat** button (⚙️ sliders icon) — opens dropdown:
  - **Style**: Default | Learning Guide | Custom (textarea for instructions)
  - **Response Length**: Shorter | Default | Longer
- **Textarea**: auto-expanding, placeholder "Ask about your sources..."
- **Send button**: accent colored, disabled when empty
- **Keyboard**: Enter to send, Shift+Enter for newline
- **Streaming indicator**: animated dots while generating

### 2.3 Studio Panel (Right)

#### Tabs/Sections
- **Notes** tab
- **Artifacts** tab

#### Notes Section
- **"+ Add Note"** button
- Note cards list:
  - Written note: title preview, edit icon, pin icon
  - Saved response: "From chat" badge, read-only indicator
  - Each card: 3-dot menu (Edit, Pin, Convert to Source, Delete)
- **Note Editor**: inline expanding editor with markdown support
- **Bulk actions**: "Convert All Notes to Source" button

#### Artifacts Section
- **Generate buttons** (grid of action cards):
  - 📋 Study Guide
  - ❓ FAQ
  - 📄 Briefing Doc
  - 📅 Timeline
  - 🗺️ Mind Map
  - 🃏 Flashcards
  - 📝 Quiz
  - 🎧 Audio Overview (V2)
  - 🎬 Video Overview (V2)
  - 📊 Infographic (V2)
  - 📑 Slide Deck (V2)

- **Generated artifacts list** (below buttons):
  - Card per artifact: type icon, title, status badge (generating/ready/error), created date
  - Click → open artifact viewer
  - 3-dot menu: Download, Delete, Regenerate

#### Artifact Viewers (Modal/Full-panel)
- **Study Guide/FAQ/Briefing/Timeline**: Markdown rendered, export buttons
- **Flashcards**: Flip card UI, prev/next, progress bar, difficulty filter
- **Quiz**: Question cards, answer input, submit, scoring, explanations
- **Mind Map**: Interactive D3.js canvas, zoom/pan, expand/collapse nodes
- **Audio Overview**: Waveform player, play/pause, speed, download MP3

---

## 3. Settings Page (`/settings`)

| Section | Controls |
|---------|----------|
| **Model Provider** | Radio: Ollama / OpenAI / Gemini / Anthropic |
| **Connection** | Ollama URL input (default localhost:11434) |
| **API Key** | Password input + show/hide toggle |
| **Chat Model** | Dropdown (auto-populated from provider) |
| **Embedding Model** | Dropdown (auto-populated) |
| **TTS Provider** | Dropdown: Browser Web Speech / Kokoro / Piper |
| **Theme** | Toggle: Dark / Light / System |
| **Data** | Export all data, Clear all data |

---

## 4. Design System

### Colors (Dark Theme — Default)
```css
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--bg-tertiary: #1a1a2e;
--bg-card: rgba(255,255,255,0.04);
--bg-glass: rgba(255,255,255,0.06);
--text-primary: #e8e8ed;
--text-secondary: #8e8ea0;
--accent: #6c5ce7;
--accent-gradient: linear-gradient(135deg, #6c5ce7, #a855f7);
--border: rgba(255,255,255,0.08);
--citation-bg: rgba(108,92,231,0.2);
--success: #00cec9;
--warning: #fdcb6e;
--error: #e17055;
```

### Typography
- Font: `Inter` (Google Fonts)
- Headings: 600-700 weight
- Body: 400 weight, 15px
- Code: `JetBrains Mono`

### Effects
- Glassmorphism: `backdrop-filter: blur(20px)` on panels
- Border radius: 12px cards, 8px buttons, 20px pills
- Shadows: layered box-shadows for depth
- Transitions: 200ms ease for hovers, 300ms for panels
- Micro-animations: fade-in for messages, slide for panels

### Responsive Breakpoints
- Desktop: 3-panel side by side (>1200px)
- Tablet: Sources collapsible, Chat + Studio (768-1200px)
- Mobile: Tab-based panel switching (<768px)
