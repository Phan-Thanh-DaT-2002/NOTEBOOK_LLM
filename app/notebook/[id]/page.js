'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Settings, BookOpen, MessageSquare, Edit3, 
  ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose,
  FileText, HelpCircle, Layers, Sliders, Info, Loader2, Save,
  Plus, Trash2, Globe, Video, FileText as TextIcon, AlertTriangle, 
  Check, X, Sparkles, Search, CheckSquare, Square, Pin, RotateCcw, Award, Clock
} from 'lucide-react';
import MarkdownIt from 'markdown-it';
import styles from './workspace.module.css';
import { useToast } from '@/components/ui/Toast.js';
import EmptyState from '@/components/ui/EmptyState.js';
import ConfirmDialog from '@/components/ui/ConfirmDialog.js';
import MindMap from '@/components/studio/MindMap.js';
import TimelineView from '@/components/studio/TimelineView.js';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

export default function Workspace() {
  const router = useRouter();
  const toast = useToast();
  const { id: notebookId } = useParams();

  // Notebook states
  const [notebook, setNotebook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [titleInput, setTitleInput] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  // Sources states
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedSource, setSelectedSource] = useState(null); // Active viewer source

  // Modal control states
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'file', 'url', 'youtube', 'text'
  const [submittingSource, setSubmittingSource] = useState(false);

  // Delete source states
  const [deleteSourceId, setDeleteSourceId] = useState(null);
  const [deleteSourceTitle, setDeleteSourceTitle] = useState('');

  // Pasted Text inputs
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  // Web URL inputs
  const [urlInput, setUrlInput] = useState('');

  // Search in document
  const [viewerSearch, setViewerSearch] = useState('');

  // Notes & Artifacts states
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [activeNote, setActiveNote] = useState(null); // { id: string | null, title: string, content: string }
  const [activeArtifact, setActiveArtifact] = useState(null); // { id, title, output_markdown }
  const [generatingType, setGeneratingType] = useState(null); // 'briefing_doc' | 'study_guide' | 'faq' | 'timeline' | 'flashcards' | 'quiz' | null
  const [activeStudySession, setActiveStudySession] = useState(null); // { type, artifact, currentIndex, answers, flipped, score }
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [quizTimer, setQuizTimer] = useState(30);

  // Chat & RAG states
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Layout Panel States
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState('chat'); // 'sources', 'chat', 'studio'

  const chatEndRef = useRef(null);
  const highlightRef = useRef(null);

  const fileInputRef = useRef(null);

  // Fetch Notebook details
  const fetchNotebookDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}`);
      const json = await res.json();

      if (json.ok && json.data) {
        setNotebook(json.data);
        setTitleInput(json.data.title);
      } else {
        toast.error(json.error?.message || 'Failed to load notebook');
        router.push('/');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error loading notebook details');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [notebookId, toast, router]);

  // Fetch Sources list
  const fetchSources = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoadingSources(true);
      const res = await fetch(`/api/sources?notebookId=${notebookId}`);
      const json = await res.json();
      if (json.ok) {
        setSources(json.data);
      } else {
        toast.error(json.error?.message || 'Failed to load sources');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoadingSources(false);
    }
  }, [notebookId, toast]);

  // Fetch Chat History
  const fetchChatHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/history?notebookId=${notebookId}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setMessages(json.data);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  }, [notebookId]);

  // Fetch Suggested Questions
  const fetchSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const res = await fetch(`/api/chat/suggestions?notebookId=${notebookId}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setSuggestions(json.data);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [notebookId]);

  // Fetch Notes list
  const fetchNotes = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoadingNotes(true);
      const res = await fetch(`/api/notes?notebookId=${notebookId}`);
      const json = await res.json();
      if (json.ok) {
        setNotes(json.data);
      } else {
        toast.error(json.error?.message || 'Failed to load notes');
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      if (showLoading) setLoadingNotes(false);
    }
  }, [notebookId, toast]);

  // Fetch Artifacts list
  const fetchArtifacts = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoadingArtifacts(true);
      const res = await fetch(`/api/artifacts?notebookId=${notebookId}`);
      const json = await res.json();
      if (json.ok) {
        setArtifacts(json.data);
      }
    } catch (err) {
      console.error('Error fetching artifacts:', err);
    } finally {
      if (showLoading) setLoadingArtifacts(false);
    }
  }, [notebookId]);

  useEffect(() => {
    if (notebookId) {
      fetchNotebookDetails();
      fetchSources(true);
      fetchChatHistory();
      fetchSuggestions();
      fetchNotes(true);
      fetchArtifacts(true);
    }
  }, [notebookId, fetchNotebookDetails, fetchSources, fetchChatHistory, fetchSuggestions, fetchNotes, fetchArtifacts]);

  // Scroll chat history to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll source viewer to highlighted citation quote
  useEffect(() => {
    if (selectedSource && viewerSearch && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [selectedSource, viewerSearch]);

  // Handle Send Message (Stream SSE)
  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || chatInput).trim();
    if (!queryText) return;

    if (isStreaming) return;

    setChatInput('');
    setIsStreaming(true);

    const tempUserMsg = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      content: queryText, 
      created_at: new Date().toISOString() 
    };
    
    const tempAssistantMsg = { 
      id: crypto.randomUUID(), 
      role: 'assistant', 
      content: '', 
      created_at: new Date().toISOString(),
      citations: [],
      webSources: []
    };

    setMessages(prev => [...prev, tempUserMsg, tempAssistantMsg]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, question: queryText, webSearchEnabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to start chat completion');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let partialLine = '';
      let currentEvent = 'token';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        partialLine += chunk;

        const lines = partialLine.split('\n');
        partialLine = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.replace('event: ', '').trim();
          } else if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace('data: ', '').trim();
            try {
              const json = JSON.parse(dataStr);
              if (currentEvent === 'token') {
                accumulatedText += json.text;
                setMessages(prev => prev.map(m => 
                  m.id === tempAssistantMsg.id ? { ...m, content: accumulatedText } : m
                ));
              } else if (currentEvent === 'citations') {
                setMessages(prev => prev.map(m => 
                  m.id === tempAssistantMsg.id ? { ...m, citations: json } : m
                ));
              } else if (currentEvent === 'web_sources') {
                setMessages(prev => prev.map(m => 
                  m.id === tempAssistantMsg.id ? { ...m, webSources: json } : m
                ));
              } else if (currentEvent === 'done') {
                setMessages(prev => prev.map(m => 
                  m.id === tempAssistantMsg.id ? { ...m, id: json.messageId } : m
                ));
              } else if (currentEvent === 'error') {
                toast.error(json.message || 'Stream error');
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error during chat');
      setMessages(prev => prev.map(m => 
        m.id === tempAssistantMsg.id 
          ? { ...m, content: 'Đã xảy ra lỗi kết nối với mô hình LLM. Vui lòng kiểm tra lại dịch vụ Ollama hoặc API Key.' } 
          : m
      ));
    } finally {
      setIsStreaming(false);
      fetchSuggestions();
    }
  };

  // Handle Clear Chat
  const handleClearChat = async () => {
    try {
      const res = await fetch(`/api/chat/history?notebookId=${notebookId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.ok) {
        setMessages([]);
        toast.success('Conversation history cleared');
        fetchSuggestions();
      } else {
        toast.error(json.error?.message || 'Failed to clear history');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error clearing chat history');
    }
  };

  // Handle Citation Trigger Click
  const handleCitationClick = (citation) => {
    const source = sources.find(s => s.id === citation.source_id);
    if (source) {
      setSelectedSource(source);
      setViewerSearch(citation.quote || '');
      setMobileActiveTab('sources');
      toast.success(`Opening citation from: ${source.filename}`);
    } else {
      toast.error('Source file not found or is disabled');
    }
  };

  // Polling for processing sources
  useEffect(() => {
    const isProcessing = sources.some(s => s.sync_status === 'pending' || s.sync_status === 'processing');
    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchSources();
    }, 2500);

    return () => clearInterval(interval);
  }, [sources, fetchSources]);

  // Rename Notebook Title
  const handleRename = async () => {
    if (!titleInput.trim()) {
      setTitleInput(notebook?.title || '');
      return;
    }
    if (titleInput.trim() === notebook?.title) {
      return;
    }

    try {
      setSavingTitle(true);
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.trim() }),
      });
      const json = await res.json();

      if (json.ok) {
        setNotebook(json.data);
        setTitleInput(json.data.title);
        toast.success('Notebook renamed');
      } else {
        toast.error(json.error?.message || 'Failed to rename notebook');
        setTitleInput(notebook?.title || '');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error renaming notebook');
      setTitleInput(notebook?.title || '');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // Toggle Source Enabled/Disabled
  const handleToggleSource = async (e, sourceId, currentVal) => {
    e.stopPropagation(); // Avoid opening viewer
    const newVal = currentVal === 1 ? 0 : 1;
    
    // Optimistic update
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled: newVal } : s));

    try {
      const res = await fetch(`/api/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newVal === 1 }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message || 'Failed to update source status');
        // Rollback
        setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled: currentVal } : s));
      } else {
        fetchSuggestions();
      }
    } catch (err) {
      console.error(err);
      // Rollback
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled: currentVal } : s));
    }
  };

  // Delete Source
  const handleDeleteSource = async () => {
    const sId = deleteSourceId;
    setDeleteSourceId(null);

    try {
      toast.warning('Deleting source...');
      const res = await fetch(`/api/sources/${sId}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.ok) {
        toast.success('Source deleted');
        setSources(prev => prev.filter(s => s.id !== sId));
        if (selectedSource?.id === sId) {
          setSelectedSource(null);
        }
        fetchSuggestions();
      } else {
        toast.error(json.error?.message || 'Failed to delete source');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error deleting source');
    }
  };

  // Upload File Submit
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setActiveModal(null);
    setSubmittingSource(true);
    toast.warning('Uploading file...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('notebookId', notebookId);

    try {
      const res = await fetch('/api/sources/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (json.ok) {
        toast.success('File uploaded, processing started');
        fetchSources();
      } else {
        toast.error(json.error?.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error uploading file');
    } finally {
      setSubmittingSource(false);
    }
  };

  // Import Link/YouTube Submit
  const handleImportLink = async (type) => {
    if (!urlInput.trim()) {
      toast.warning('Please enter a valid URL');
      return;
    }

    setActiveModal(null);
    setSubmittingSource(true);
    toast.warning('Importing link...');

    try {
      const res = await fetch('/api/sources/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          type,
          url: urlInput.trim(),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success('Source imported, processing started');
        setUrlInput('');
        fetchSources();
      } else {
        toast.error(json.error?.message || 'Import failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error importing link');
    } finally {
      setSubmittingSource(false);
    }
  };

  // Paste Text Submit
  const handleImportPaste = async () => {
    if (!pasteContent.trim()) {
      toast.warning('Pasted content cannot be empty');
      return;
    }

    setActiveModal(null);
    setSubmittingSource(true);
    toast.warning('Saving text...');

    try {
      const res = await fetch('/api/sources/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          type: 'text',
          filename: pasteTitle.trim() || 'Pasted Text',
          text: pasteContent.trim(),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success('Text saved and processed');
        setPasteTitle('');
        setPasteContent('');
        fetchSources();
        fetchSuggestions();
      } else {
        toast.error(json.error?.message || 'Import failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error importing text');
    } finally {
      setSubmittingSource(false);
    }
  };

  // Get Source Icon
  const getSourceIcon = (type) => {
    switch (type) {
      case 'pdf': return <BookOpen size={18} style={{ color: '#ff7675' }} />;
      case 'docx': return <TextIcon size={18} style={{ color: '#54a0ff' }} />;
      case 'url': return <Globe size={18} style={{ color: '#1dd1a1' }} />;
      case 'youtube': return <Video size={18} style={{ color: '#ff9f43' }} />;
      default: return <TextIcon size={18} style={{ color: '#a29bfe' }} />;
    }
  };

  // Save written / edited note
  const handleSaveNote = async (title, content) => {
    if (!content.trim()) {
      toast.warning('Nội dung ghi chú không được để trống.');
      return;
    }

    try {
      const isEdit = activeNote && activeNote.id;
      const url = isEdit ? `/api/notes/${activeNote.id}` : '/api/notes';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          title: title.trim() || 'Ghi chú chưa đặt tên',
          content: content.trim(),
          type: 'written'
        }),
      });

      const json = await res.json();
      if (json.ok) {
        toast.success(isEdit ? 'Đã cập nhật ghi chú' : 'Đã tạo ghi chú mới');
        setActiveNote(null);
        setIsEditingNote(false);
        fetchNotes();
      } else {
        toast.error(json.error?.message || 'Lưu ghi chú thất bại');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi lưu ghi chú');
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ghi chú này không?')) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.ok) {
        toast.success('Đã xóa ghi chú');
        fetchNotes();
      } else {
        toast.error(json.error?.message || 'Xóa ghi chú thất bại');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi xóa ghi chú');
    }
  };

  // Pin / Unpin note
  const handleTogglePinNote = async (note) => {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success(note.pinned ? 'Đã bỏ ghim ghi chú' : 'Đã ghim ghi chú');
        fetchNotes();
      } else {
        toast.error(json.error?.message || 'Thay đổi trạng thái ghim thất bại');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Convert Note to Source Document
  const handleConvertNoteToSource = async (note) => {
    toast.warning('Đang chuyển đổi ghi chú thành tài liệu nguồn...');
    try {
      const res = await fetch('/api/sources/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          type: 'text',
          filename: `Ghi chú: ${note.title || 'Chưa đặt tên'}`,
          text: note.content
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success('Đã chuyển đổi ghi chú thành tài liệu nguồn thành công!');
        fetchSources();
      } else {
        toast.error(json.error?.message || 'Chuyển đổi thất bại');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi chuyển đổi ghi chú');
    }
  };

  // Save Assistant message to Note
  const handleSaveResponseToNote = async (message) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          title: 'Phản hồi từ AI',
          content: message.content,
          type: 'saved',
          sourceMessageId: message.id
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success('Đã lưu phản hồi vào mục Ghi chú');
        fetchNotes();
      } else {
        toast.error(json.error?.message || 'Lưu phản hồi thất bại');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi lưu phản hồi');
    }
  };

  // Generate study artifact (Briefing doc, FAQ, etc.) and poll status
  const handleGenerateArtifact = async (type) => {
    if (generatingType) {
      toast.warning('Đang có tiến trình tạo tài liệu khác hoạt động.');
      return;
    }
    setGeneratingType(type);
    toast.warning('Đang bắt đầu tạo tài liệu học tập...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, type }),
      });
      const json = await res.json();

      if (!json.ok) {
        toast.error(json.error?.message || 'Khởi tạo tiến trình thất bại');
        setGeneratingType(null);
        return;
      }

      const artifactId = json.data.id;
      
      // Setup polling interval to check status
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/artifacts?artifactId=${artifactId}`);
          const pollJson = await pollRes.json();
          
          if (pollJson.ok && pollJson.data) {
            const art = pollJson.data;
            if (art.status === 'ready') {
              clearInterval(interval);
              setGeneratingType(null);
              fetchArtifacts();
              if (art.type === 'flashcards' || art.type === 'quiz') {
                if (art.type === 'flashcards' && art.items) {
                  art.items = [...art.items].sort((a, b) => {
                    const statusA = a.progress_status || 'unseen';
                    const statusB = b.progress_status || 'unseen';
                    if (statusA === 'incorrect' && statusB !== 'incorrect') return -1;
                    if (statusA !== 'incorrect' && statusB === 'incorrect') return 1;
                    if (statusA === 'unseen' && statusB === 'correct') return -1;
                    if (statusA === 'correct' && statusB === 'unseen') return 1;
                    return 0;
                  });
                }
                setActiveStudySession({
                  type: art.type,
                  artifact: art,
                  currentIndex: 0,
                  answers: {},
                  flipped: false,
                  score: 0
                });
              } else {
                setActiveArtifact(art);
              }
              toast.success(`Tạo thành công: ${art.title}!`);
            } else if (art.status === 'error') {
              clearInterval(interval);
              setGeneratingType(null);
              toast.error(art.error_message || 'Có lỗi xảy ra trong lúc tạo tài liệu.');
            }
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi tạo tài liệu');
      setGeneratingType(null);
    }
  };

  const handleOpenArtifact = async (artifact) => {
    try {
      const res = await fetch(`/api/artifacts?artifactId=${artifact.id}`);
      const json = await res.json();
      if (json.ok && json.data) {
        const fullArt = json.data;
        if (fullArt.type === 'flashcards' || fullArt.type === 'quiz') {
          if (fullArt.type === 'flashcards' && fullArt.items) {
            fullArt.items = [...fullArt.items].sort((a, b) => {
              const statusA = a.progress_status || 'unseen';
              const statusB = b.progress_status || 'unseen';
              if (statusA === 'incorrect' && statusB !== 'incorrect') return -1;
              if (statusA !== 'incorrect' && statusB === 'incorrect') return 1;
              if (statusA === 'unseen' && statusB === 'correct') return -1;
              if (statusA === 'correct' && statusB === 'unseen') return 1;
              return 0;
            });
          }
          setActiveStudySession({
            type: fullArt.type,
            artifact: fullArt,
            currentIndex: 0,
            answers: {},
            flipped: false,
            score: 0
          });
        } else {
          setActiveArtifact(fullArt);
        }
      } else {
        toast.error('Không thể tải chi tiết tài liệu học tập.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi tải tài liệu.');
    }
  };

  const handleUpdateStudyProgress = useCallback(async (itemId, status, score) => {
    if (!activeStudySession) return;
    try {
      const res = await fetch('/api/artifacts/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId: activeStudySession.artifact.id,
          itemId,
          status,
          score
        })
      });
      const json = await res.json();
      if (!json.ok) {
        console.error('Failed to update progress:', json.error);
      }
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  }, [activeStudySession]);

  const handleQuizTimeout = useCallback(async () => {
    if (!activeStudySession) return;
    const { currentIndex, answers, score, artifact } = activeStudySession;
    const items = artifact.items || [];
    const currentItem = items[currentIndex];
    
    // Choose -1 (timeout)
    const nextAnswers = { ...answers, [currentIndex]: -1 };
    await handleUpdateStudyProgress(currentItem.id, 'incorrect', 0);
    
    setActiveStudySession({
      ...activeStudySession,
      answers: nextAnswers,
      score
    });
    toast.error('Hết thời gian trả lời câu hỏi này!');
  }, [activeStudySession, toast, handleUpdateStudyProgress]);

  useEffect(() => {
    if (!activeStudySession || activeStudySession.type !== 'quiz') return;
    const { currentIndex, answers, artifact } = activeStudySession;
    const items = artifact.items || [];
    if (currentIndex >= items.length) return; // Quiz completed

    const hasAnswered = answers[currentIndex] !== undefined;
    if (hasAnswered) return;

    const timer = setInterval(() => {
      setQuizTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleQuizTimeout();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeStudySession, handleQuizTimeout]);

  useEffect(() => {
    if (activeStudySession?.type === 'quiz') {
      setQuizTimer(30);
    }
  }, [activeStudySession?.currentIndex, activeStudySession?.type]);

  if (loading) {
    return (
      <div className={styles.workspace} style={{ alignItems: 'center', justifyContent: 'center' }} suppressHydrationWarning>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: '12px' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading workspace...</span>
      </div>
    );
  }

  return (
    <div className={styles.workspace} suppressHydrationWarning>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.btnBack} onClick={() => router.push('/')} title="Back to Dashboard" aria-label="Back to Dashboard">
            <ArrowLeft size={18} />
          </button>
          
          <div className={styles.titleInputWrapper}>
            <input
              type="text"
              className={styles.titleInput}
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              disabled={savingTitle}
            />
            {savingTitle && (
              <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: '-24px', color: 'var(--text-muted)' }} />
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          {notebook?.chat_model && (
            <span className={styles.modelBadge}>
              {notebook.chat_model}
            </span>
          )}
          <button 
            className={styles.btnSettings} 
            onClick={() => router.push('/settings')}
            title="System Settings"
            aria-label="System Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Panels Workspace */}
      <div className={styles.panelsContainer}>
        
        {/* PANEL 1: SOURCES (COLLAPSIBLE) */}
        {!sourcesCollapsed ? (
          <div className={`${styles.panel} ${styles.sourcesPanel} ${mobileActiveTab === 'sources' ? styles.panelActive : ''}`}>
            <div className={styles.panelHeader}>
              <h2>Sources ({sources.length})</h2>
              <div className={styles.panelHeaderActions}>
                <button 
                  className={`${styles.iconBtn} ${styles.iconBtnAccent}`} 
                  onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                  title="Add Source Source"
                  aria-label="Add Source Source"
                >
                  <Plus size={18} />
                </button>
                <button 
                  className={styles.iconBtn} 
                  onClick={() => setSourcesCollapsed(true)}
                  title="Collapse Panel"
                  aria-label="Collapse Sources Panel"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            </div>
            
            <div className={styles.panelContent}>
              {/* Add menu options */}
              {isAddMenuOpen && (
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <button className={styles.btnCancel} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={() => { setActiveModal('file'); setIsAddMenuOpen(false); }}>
                    <BookOpen size={16} /> Upload File (PDF, DOCX)
                  </button>
                  <button className={styles.btnCancel} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={() => { setActiveModal('url'); setIsAddMenuOpen(false); }}>
                    <Globe size={16} /> Import Web Link
                  </button>
                  <button className={styles.btnCancel} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={() => { setActiveModal('youtube'); setIsAddMenuOpen(false); }}>
                    <Video size={16} /> Import YouTube Link
                  </button>
                  <button className={styles.btnCancel} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={() => { setActiveModal('text'); setIsAddMenuOpen(false); }}>
                    <TextIcon size={16} /> Paste Raw Text
                  </button>
                </div>
              )}

              {loadingSources ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ height: '50px', background: 'var(--bg-secondary)', borderRadius: '6px' }} className="shimmer" />
                  <div style={{ height: '50px', background: 'var(--bg-secondary)', borderRadius: '6px' }} className="shimmer" />
                </div>
              ) : sources.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Add Sources"
                  description="Upload PDFs, paste text, or link articles to start analyzing."
                />
              ) : (
                <div className={styles.sourceList}>
                  {sources.map(source => {
                    const isProcessing = source.sync_status === 'pending' || source.sync_status === 'processing';
                    const isReady = source.sync_status === 'ready';
                    const isErr = source.sync_status === 'error';
                    
                    return (
                      <div 
                        key={source.id} 
                        className={`${styles.sourceCard} ${source.enabled === 0 ? styles.sourceCardDisabled : ''}`}
                        onClick={() => isReady && setSelectedSource(source)}
                      >
                        {/* Checkbox selector */}
                        <div 
                          className={styles.sourceCheck}
                          onClick={(e) => handleToggleSource(e, source.id, source.enabled)}
                        >
                          {source.enabled === 1 ? (
                            <CheckSquare size={16} style={{ color: 'var(--accent)' }} />
                          ) : (
                            <Square size={16} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </div>

                        {/* File icon */}
                        <div style={{ marginTop: '2px' }}>
                          {getSourceIcon(source.file_type)}
                        </div>

                        {/* Info details */}
                        <div className={styles.sourceInfo}>
                          <div className={styles.sourceTitle} title={source.filename}>
                            {source.filename}
                          </div>
                          
                          <div className={styles.sourceMeta}>
                            {isReady && <span>{source.word_count || 0} words</span>}
                            
                            {/* Sync Status Badge */}
                            {isProcessing && (
                              <span className={`${styles.sourceStatus} ${styles.statusProcessing}`}>
                                <Loader2 size={11} className="animate-spin" />
                                {source.job_status === 'processing' && source.total_chunks > 0 ? (
                                  `indexing (${Math.round((source.processed_chunks / source.total_chunks) * 100)}%)`
                                ) : (
                                  'processing...'
                                )}
                              </span>
                            )}
                            
                            {isErr && (
                              <span 
                                className={`${styles.sourceStatus} ${styles.statusError}`} 
                                title={source.job_error || 'Processing failed'}
                              >
                                <AlertTriangle size={11} /> Failed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Deletion btn */}
                        <button 
                          className={styles.sourceDeleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteSourceId(source.id);
                            setDeleteSourceTitle(source.filename);
                          }}
                          title="Delete Source"
                          aria-label="Delete Source"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            className={styles.collapsedPanelPlaceholder}
            onClick={() => setSourcesCollapsed(false)}
            title="Expand Sources Panel"
          >
            <BookOpen size={16} style={{ color: 'var(--text-muted)' }} />
            <span className={styles.verticalText}>Sources</span>
          </div>
        )}

        {/* DRAGGABLE RESIZER HANDLE 1 */}
        {!sourcesCollapsed && <div className={styles.resizer} />}

        {/* PANEL 2: CHAT */}
        <div className={`${styles.panel} ${styles.chatPanel} ${mobileActiveTab === 'chat' ? styles.panelActive : ''}`}>
          <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2>Chat & Research</h2>
              {messages.length > 0 && (
                <button 
                  className={styles.iconBtn} 
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  aria-label="Clear Chat History"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {sourcesCollapsed && (
                <button 
                  className={styles.iconBtn} 
                  onClick={() => setSourcesCollapsed(false)}
                  title="Expand Sources"
                  aria-label="Expand Sources"
                >
                  <ChevronRight size={16} />
                </button>
              )}
              {studioCollapsed && (
                <button 
                  className={styles.iconBtn} 
                  onClick={() => setStudioCollapsed(false)}
                  title="Expand Studio"
                  aria-label="Expand Studio"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>
          </div>

          <div className={styles.chatContainer}>
            {/* Messages Scroll View */}
            <div className={styles.chatHistory}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <EmptyState
                    icon={MessageSquare}
                    title={`Chào mừng tới ${notebook?.title || 'Notebook'}`}
                    description="Đặt câu hỏi về các tài liệu đã bật để trích xuất thông tin, tóm tắt dữ liệu hoặc tạo bộ câu hỏi tự học."
                  />
                  
                  {/* Suggestions Chips when chat is empty */}
                  {suggestions.length > 0 && (
                    <div className={styles.suggestionsGrid}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '4px' }}>
                        Gợi ý câu hỏi nghiên cứu
                      </span>
                      {suggestions.map((q, idx) => (
                        <button 
                          key={idx}
                          className={styles.suggestionCard}
                          onClick={() => handleSendMessage(q)}
                          disabled={isStreaming}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    
                    return (
                      <div 
                        key={msg.id} 
                        className={`${styles.messageRow} ${isUser ? styles.messageRowUser : styles.messageRowAssistant}`}
                      >
                        <div className={`${styles.messageAvatar} ${isUser ? styles.messageAvatarUser : styles.messageAvatarAssistant}`}>
                          {isUser ? 'U' : <Sparkles size={14} />}
                        </div>
                        
                        {isUser ? (
                          <div className={`${styles.messageBubble} ${styles.messageBubbleUser}`}>
                            {msg.content}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', maxWidth: '85%' }}>
                            <div 
                              className={`${styles.messageBubble} ${styles.messageBubbleAssistant} markdown-content`}
                              onClick={(e) => {
                                const trigger = e.target.closest('.citation-badge-trigger');
                                if (trigger) {
                                  const index = parseInt(trigger.dataset.index, 10);
                                  const cit = msg.citations?.find(c => c.citation_index === index);
                                  if (cit) {
                                    handleCitationClick(cit);
                                  }
                                }
                              }}
                              dangerouslySetInnerHTML={{
                                __html: (() => {
                                  let contentStr = msg.content || '';
                                  let thinkingHtml = '';

                                  // Extract and style closed <think> blocks
                                  contentStr = contentStr.replace(/<think>([\s\S]*?)<\/think>/gi, (match, thinkingText) => {
                                    thinkingHtml += `
                                      <div style="
                                        background: rgba(255, 255, 255, 0.02);
                                        border-left: 2px solid var(--accent);
                                        padding: 8px 12px;
                                        margin-bottom: 12px;
                                        border-radius: 4px;
                                        font-size: 11.5px;
                                        color: var(--text-muted);
                                        font-style: italic;
                                        width: 100%;
                                      ">
                                        <div style="display: flex; align-items: center; gap: 6px; font-weight: bold; margin-bottom: 4px; color: var(--accent); font-style: normal; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z"/></svg>
                                          Tiến trình suy nghĩ của AI:
                                        </div>
                                        <div style="opacity: 0.85;">${md.render(thinkingText)}</div>
                                      </div>
                                    `;
                                    return '';
                                  });

                                  // Extract and style unclosed streaming <think> blocks
                                  if (contentStr.includes('<think>')) {
                                    contentStr = contentStr.replace(/<think>([\s\S]*)$/gi, (match, thinkingText) => {
                                      thinkingHtml += `
                                        <div style="
                                          background: rgba(255, 255, 255, 0.02);
                                          border-left: 2px solid var(--accent);
                                          padding: 8px 12px;
                                          margin-bottom: 12px;
                                          border-radius: 4px;
                                          font-size: 11.5px;
                                          color: var(--text-muted);
                                          font-style: italic;
                                          width: 100%;
                                        ">
                                          <div style="display: flex; align-items: center; gap: 6px; font-weight: bold; margin-bottom: 4px; color: var(--accent); font-style: normal; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: pulse 1.5s infinite;"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z"/></svg>
                                            AI đang suy nghĩ...
                                          </div>
                                          <div style="opacity: 0.85;">${md.render(thinkingText)}</div>
                                        </div>
                                      `;
                                      return '';
                                    });
                                  }

                                  // Clean raw reasoning XML tags from output
                                  contentStr = contentStr.replace(/<\/?(answer|thought)>/gi, '');

                                  let html = thinkingHtml + md.render(contentStr || '');

                                  // Replace Web citations first
                                  html = html.replace(/\[Web Result (\d+)\]/g, (match, digit) => {
                                    const index = parseInt(digit, 10);
                                    const ws = msg.webSources?.[index - 1];
                                    const titleStr = ws ? `Nguồn web: ${ws.title}\n${ws.url}` : 'Xem liên kết';
                                    return ws ? `<a href="${ws.url}" target="_blank" rel="noopener noreferrer" title="${titleStr}" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(0, 184, 148, 0.15); border: 1px solid rgba(0, 184, 148, 0.3); color: #00b894; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 0 4px; margin: 0 2px; text-decoration: none; vertical-align: super;"><span style="display: inline-flex; align-items: center; gap: 2px;"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> Web ${index}</span></a>` : `<span style="display: inline-flex; align-items: center; justify-content: center; background: rgba(0, 184, 148, 0.15); border: 1px solid rgba(0, 184, 148, 0.3); color: #00b894; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 0 4px; margin: 0 2px; vertical-align: super;">Web ${index}</span>`;
                                  });
                                  // Replace Local citations second
                                  return html.replace(/\[(\d+)\]/g, (match, digit) => {
                                    const index = parseInt(digit, 10);
                                    const cit = msg.citations?.find(c => c.citation_index === index);
                                    const titleStr = cit ? `Nguồn: ${cit.filename} ${cit.page_number ? `(Trang ${cit.page_number})` : ''}` : 'Xem trích dẫn';
                                    return `<span class="citation-badge-trigger" data-index="${index}" title="${titleStr}" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(108, 92, 231, 0.15); border: 1px solid rgba(108, 92, 231, 0.3); color: var(--accent); font-size: 10px; font-weight: 700; border-radius: 4px; padding: 0 4px; margin: 0 2px; cursor: pointer; vertical-align: super;">${index}</span>`;
                                  });
                                })()
                              }}
                            />
                            {msg.webSources && msg.webSources.length > 0 && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                paddingLeft: '12px',
                                marginTop: '4px',
                                marginBottom: '4px'
                              }}>
                                <span style={{
                                  fontSize: '10px',
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: '100%',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>
                                  <Globe size={10} style={{ color: 'var(--accent)' }} /> Đã tra cứu nguồn internet:
                                </span>
                                {msg.webSources.map((ws, wIdx) => (
                                  <a 
                                    key={wIdx}
                                    href={ws.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={ws.snippet}
                                    style={{
                                      fontSize: '10px',
                                      color: 'var(--accent)',
                                      background: 'rgba(108, 92, 231, 0.08)',
                                      border: '1px solid rgba(108, 92, 231, 0.2)',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      textDecoration: 'none',
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(108, 92, 231, 0.15)';
                                      e.currentTarget.style.borderColor = 'var(--accent)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(108, 92, 231, 0.08)';
                                      e.currentTarget.style.borderColor = 'rgba(108, 92, 231, 0.2)';
                                    }}
                                  >
                                    <Globe size={8} /> {ws.title.length > 25 ? ws.title.substring(0, 25) + '...' : ws.title}
                                  </a>
                                ))}
                              </div>
                            )}
                            {!isStreaming && msg.content && (
                              <button 
                                onClick={() => handleSaveResponseToNote(msg)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  marginLeft: '12px'
                                }}
                                onMouseEnter={(e) => e.target.style.color = 'var(--accent)'}
                                onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                              >
                                <Save size={12} /> Lưu phản hồi vào Ghi chú
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '40px' }}>
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mô hình đang tổng hợp dữ liệu nguồn...</span>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Input Form Section */}
            <div className={styles.chatInputSection}>
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className={styles.chatInputWrapper}
              >
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled(prev => !prev)}
                  title={webSearchEnabled ? "Tắt tra mạng (Web Search ON)" : "Bật tra mạng (Web Search OFF)"}
                  aria-label="Toggle Web Search"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    background: webSearchEnabled ? 'rgba(108, 92, 231, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: webSearchEnabled ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: webSearchEnabled ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    marginRight: '8px',
                    boxShadow: webSearchEnabled ? '0 0 12px rgba(108, 92, 231, 0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!webSearchEnabled) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.color = 'var(--text)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!webSearchEnabled) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <Globe size={18} />
                </button>
                <input
                  type="text"
                  className={styles.chatInput}
                  placeholder={
                    webSearchEnabled
                      ? "Hỏi mô hình kèm theo thông tin tra cứu từ internet..."
                      : sources.filter(s => s.enabled === 1 && s.sync_status === 'ready').length === 0
                        ? "Hãy kích hoạt ít nhất 1 nguồn tài liệu (hoặc bật Tra mạng) để trò chuyện..."
                        : "Hỏi mô hình về tài liệu nguồn của bạn..."
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isStreaming || (!webSearchEnabled && sources.filter(s => s.enabled === 1 && s.sync_status === 'ready').length === 0)}
                />
                <button
                  type="submit"
                  className={styles.btnSubmit}
                  style={{ padding: '12px 20px', borderRadius: 'var(--radius-md)', height: '44px' }}
                  disabled={isStreaming || !chatInput.trim() || (!webSearchEnabled && sources.filter(s => s.enabled === 1 && s.sync_status === 'ready').length === 0)}
                >
                  {isStreaming ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Gửi"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* DRAGGABLE RESIZER HANDLE 2 */}
        {!studioCollapsed && <div className={styles.resizer} />}

        {/* PANEL 3: STUDIO & NOTES (COLLAPSIBLE) */}
        {!studioCollapsed ? (
          <div className={`${styles.panel} ${styles.studioPanel} ${mobileActiveTab === 'studio' ? styles.panelActive : ''}`}>
            <div className={styles.panelHeader}>
              <h2>Studio & Notes ({notes.length})</h2>
              <div className={styles.panelHeaderActions}>
                <button
                  className={`${styles.iconBtn} ${styles.iconBtnAccent}`}
                  onClick={() => {
                    setActiveNote({ id: null, title: '', content: '' });
                    setIsEditingNote(true);
                  }}
                  title="Thêm ghi chú mới"
                  aria-label="Add Note"
                >
                  <Plus size={16} />
                </button>
                <button 
                  className={styles.iconBtn} 
                  onClick={() => setStudioCollapsed(true)}
                  title="Collapse Panel"
                  aria-label="Collapse Studio Panel"
                >
                  <PanelRightClose size={16} />
                </button>
              </div>
            </div>
            <div className={styles.panelContent} style={{ overflowY: 'auto' }}>
              <div className={styles.studioContent}>
                
                {/* Section 1: Study Tools Generators */}
                <div className={styles.generatorsSection}>
                  <div className={styles.sectionTitle}>Bộ tạo tài liệu Studio</div>
                  <div className={styles.generatorsGrid}>
                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('briefing_doc')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'briefing_doc' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <FileText size={16} />
                      )}
                      Briefing Doc
                    </button>
                    
                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('study_guide')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'study_guide' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <HelpCircle size={16} />
                      )}
                      Study Guide
                    </button>

                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('faq')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'faq' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Info size={16} />
                      )}
                      FAQ
                    </button>

                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('timeline')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'timeline' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Layers size={16} />
                      )}
                      Timeline
                    </button>

                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('flashcards')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'flashcards' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckSquare size={16} />
                      )}
                      Flashcards
                    </button>

                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('quiz')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'quiz' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sliders size={16} />
                      )}
                      Quiz
                    </button>

                    <button 
                      className={styles.generatorBtn}
                      onClick={() => handleGenerateArtifact('mind_map')}
                      disabled={generatingType !== null}
                    >
                      {generatingType === 'mind_map' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                      )}
                      Mind Map
                    </button>
                  </div>
                </div>

                {/* Section 1.5: Generated Artifacts History */}
                {artifacts.length > 0 && (
                  <div className={styles.artifactsSection} style={{ marginBottom: '24px' }}>
                    <div className={styles.sectionTitle}>Tài liệu đã tạo</div>
                    <div className={styles.artifactsList} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {artifacts.map(art => {
                        const Icon = {
                          briefing_doc: FileText,
                          study_guide: HelpCircle,
                          faq: Info,
                          timeline: Layers,
                          flashcards: CheckSquare,
                          quiz: Sliders,
                          mind_map: Sparkles
                        }[art.type] || FileText;

                        return (
                          <div 
                            key={art.id} 
                            className={styles.artifactCard}
                            onClick={() => handleOpenArtifact(art)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 12px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              hover: { background: 'rgba(255,255,255,0.05)' }
                            }}
                          >
                            <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                              <Icon size={16} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {art.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }} suppressHydrationWarning>
                                {new Date(art.created_at).toLocaleDateString('vi-VN')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 2: Notes List */}
                <div className={styles.notesSection}>
                  <div className={styles.sectionTitle}>Ghi chú cá nhân</div>
                  {loadingNotes ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ height: '80px', background: 'var(--bg-secondary)', borderRadius: '6px' }} className="shimmer" />
                      <div style={{ height: '80px', background: 'var(--bg-secondary)', borderRadius: '6px' }} className="shimmer" />
                    </div>
                  ) : notes.length === 0 ? (
                    <EmptyState
                      icon={Edit3}
                      title="Chưa có ghi chú nào"
                      description="Hãy tạo ghi chú cá nhân hoặc lưu phản hồi từ AI vào đây."
                    />
                  ) : (
                    <div className={styles.notesList}>
                      {notes.map(note => (
                        <div 
                          key={note.id} 
                          className={`${styles.noteCard} ${note.pinned ? styles.noteCardPinned : ''}`}
                          onClick={() => {
                            setActiveNote(note);
                            setIsEditingNote(true);
                          }}
                        >
                          <div className={styles.noteCardHeader}>
                            <div className={styles.noteTitleText}>
                              {note.title || 'Ghi chú chưa đặt tên'}
                            </div>
                            {note.type === 'saved' && (
                              <span className={styles.noteBadge}>AI</span>
                            )}
                          </div>
                          
                          <div className={styles.noteCardContent}>
                            {note.content}
                          </div>

                          <div 
                            className={styles.noteCardActions}
                            onClick={(e) => e.stopPropagation()} // Prevent triggering edit modal
                          >
                            <button
                              className={`${styles.noteActionBtn} ${note.pinned ? styles.noteActionBtnActive : ''}`}
                              onClick={() => handleTogglePinNote(note)}
                              title={note.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                            >
                              <Pin size={13} style={{ fill: note.pinned ? '#fdcb6e' : 'none' }} />
                            </button>

                            <button
                              className={styles.noteActionBtn}
                              onClick={() => handleConvertNoteToSource(note)}
                              title="Chuyển thành tài liệu nguồn để hỏi AI"
                            >
                              <BookOpen size={13} />
                            </button>

                            <button
                              className={styles.noteActionBtn}
                              onClick={() => handleDeleteNote(note.id)}
                              title="Xóa ghi chú"
                              style={{ color: 'var(--danger-light)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div 
            className={styles.collapsedPanelPlaceholder}
            onClick={() => setStudioCollapsed(false)}
            title="Expand Studio Panel"
          >
            <FileText size={16} style={{ color: 'var(--text-muted)' }} />
            <span className={styles.verticalText}>Studio & Notes</span>
          </div>
        )}

        {/* SOURCE VIEWER DRAWER OVERLAY */}
        {selectedSource && (
          <div className={styles.viewerDrawer}>
            <div className={styles.viewerHeader}>
              <div className={styles.viewerTitle} title={selectedSource.filename}>
                {selectedSource.filename}
              </div>
              <button 
                className={styles.iconBtn} 
                onClick={() => setSelectedSource(null)}
                title="Close Viewer"
                aria-label="Close Viewer"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.viewerBody}>
              {/* Search Inside */}
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', alignItems: 'center' }}>
                  <Search size={16} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search inside document..."
                    value={viewerSearch}
                    onChange={(e) => setViewerSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '13px' }}
                  />
                  {viewerSearch && (
                    <button onClick={() => setViewerSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Summary section */}
              {selectedSource.summary && (
                <div className={styles.summaryBox}>
                  <div className={styles.summaryHeader}>
                    <Sparkles size={14} />
                    AI Summary
                  </div>
                  <div className={styles.summaryText}>
                    {selectedSource.summary}
                  </div>
                </div>
              )}

              {/* Text content box */}
              <div className={styles.textBox}>
                {(() => {
                  const text = selectedSource.raw_text || '';
                  const search = viewerSearch || '';
                  if (!search.trim()) return text;
                  
                  const cleanSearch = search.trim().toLowerCase();
                  const cleanText = text.toLowerCase();
                  const index = cleanText.indexOf(cleanSearch);
                  
                  if (index === -1) return text;
                  
                  const start = text.substring(0, index);
                  const match = text.substring(index, index + cleanSearch.length);
                  const end = text.substring(index + cleanSearch.length);
                  
                  return (
                    <>
                      {start}
                      <mark 
                        ref={highlightRef} 
                        style={{ 
                          background: '#feca57', 
                          color: '#2d3436', 
                          padding: '2px 4px', 
                          borderRadius: '4px', 
                          fontWeight: 'bold' 
                        }}
                      >
                        {match}
                      </mark>
                      {end}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Upload File Modal */}
      {activeModal === 'file' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Upload Document File</h3>
              <button className={styles.iconBtn} onClick={() => setActiveModal(null)} aria-label="Close Modal"><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div 
                className={styles.dragArea}
                onClick={() => fileInputRef.current?.click()}
              >
                <BookOpen size={32} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
                <div className={styles.dragAreaText}>Select a PDF, DOCX, MD, or TXT file</div>
                <div className={styles.dragAreaSub}>Maximum size: 10MB</div>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.txt,.text,.md,.csv"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setActiveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import URL Modal */}
      {activeModal === 'url' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Import Web Link</h3>
              <button className={styles.iconBtn} onClick={() => setActiveModal(null)} aria-label="Close Modal"><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="import-url">Web Page URL</label>
                <input
                  id="import-url"
                  type="url"
                  className={styles.formInput}
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setActiveModal(null)}>Cancel</button>
              <button className={styles.btnSubmit} onClick={() => handleImportLink('url')}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Import YouTube Modal */}
      {activeModal === 'youtube' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Import YouTube Transcript</h3>
              <button className={styles.iconBtn} onClick={() => setActiveModal(null)} aria-label="Close Modal"><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="youtube-url">YouTube Video URL</label>
                <input
                  id="youtube-url"
                  type="url"
                  className={styles.formInput}
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setActiveModal(null)}>Cancel</button>
              <button className={styles.btnSubmit} onClick={() => handleImportLink('youtube')}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Text Modal */}
      {activeModal === 'text' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h3>Paste Document Text</h3>
              <button className={styles.iconBtn} onClick={() => setActiveModal(null)} aria-label="Close Modal"><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="paste-title">Document Title</label>
                <input
                  id="paste-title"
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. My Custom Notes"
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="paste-content">Text Content</label>
                <textarea
                  id="paste-content"
                  className={`${styles.formInput} ${styles.formTextarea}`}
                  placeholder="Paste or write your document contents here..."
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setActiveModal(null)}>Cancel</button>
              <button className={styles.btnSubmit} onClick={handleImportPaste}>Save Document</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Editor Modal */}
      {isEditingNote && activeNote && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeaderBar}>
              <div className={styles.modalTitle}>
                {activeNote.id ? 'Chỉnh sửa Ghi chú' : 'Thêm Ghi chú mới'}
              </div>
              <button 
                className={styles.iconBtn} 
                onClick={() => {
                  setIsEditingNote(false);
                  setActiveNote(null);
                }}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalContentArea}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Tiêu đề</label>
                <input
                  type="text"
                  className={styles.modalInput}
                  placeholder="Ghi chú chưa đặt tên"
                  value={activeNote.title}
                  onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Nội dung ghi chú</label>
                <textarea
                  className={styles.modalTextarea}
                  placeholder="Nhập nội dung ghi chú của bạn tại đây..."
                  value={activeNote.content}
                  onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.modalFooterBar}>
              <button 
                className={`${styles.modalBtn} ${styles.modalBtnSecondary}`} 
                onClick={() => {
                  setIsEditingNote(false);
                  setActiveNote(null);
                }}
              >
                Hủy
              </button>
              <button 
                className={`${styles.modalBtn} ${styles.modalBtnPrimary}`} 
                onClick={() => handleSaveNote(activeNote.title, activeNote.content)}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Artifact Viewer Modal */}
      {activeArtifact && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox} style={{ maxWidth: '750px', height: '80vh' }}>
            <div className={styles.modalHeaderBar}>
              <div className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                {activeArtifact.title}
              </div>
              <button 
                className={styles.iconBtn} 
                onClick={() => setActiveArtifact(null)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <div className={`${styles.modalContentArea} ${activeArtifact.type === 'mind_map' || activeArtifact.type === 'timeline' ? '' : 'markdown-content'}`}>
              {activeArtifact.type === 'mind_map' ? (() => {
                try {
                  const data = JSON.parse(activeArtifact.output_markdown);
                  return <MindMap data={data} />;
                } catch (e) {
                  return (
                    <div style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>
                      Đang xử lý dữ liệu bản đồ tư duy hoặc định dạng lỗi...
                    </div>
                  );
                }
              })() : activeArtifact.type === 'timeline' ? (() => {
                try {
                  const events = JSON.parse(activeArtifact.output_markdown);
                  if (Array.isArray(events)) {
                    return <TimelineView events={events} />;
                  }
                } catch (e) {}
                return <div dangerouslySetInnerHTML={{ __html: md.render(activeArtifact.output_markdown || '') }} />;
              })() : (
                <div dangerouslySetInnerHTML={{ __html: md.render(activeArtifact.output_markdown || '') }} />
              )}
            </div>
            <div className={styles.modalFooterBar}>
              <button 
                className={`${styles.modalBtn} ${styles.modalBtnSecondary}`} 
                onClick={() => setActiveArtifact(null)}
              >
                Đóng
              </button>
              <button 
                className={`${styles.modalBtn} ${styles.modalBtnPrimary}`} 
                onClick={() => {
                  let noteContent = activeArtifact.output_markdown;
                  if (activeArtifact.type === 'mind_map') {
                    try {
                      const data = JSON.parse(activeArtifact.output_markdown);
                      const formatNode = (node, depth = 0) => {
                        let str = '  '.repeat(depth) + `- ${node.name}\n`;
                        if (node.children && Array.isArray(node.children)) {
                          node.children.forEach(child => {
                            str += formatNode(child, depth + 1);
                          });
                        }
                        return str;
                      };
                      noteContent = `### Bản đồ tư duy: ${data.name}\n\n` + formatNode(data);
                    } catch (e) {}
                  } else if (activeArtifact.type === 'timeline') {
                    try {
                      const events = JSON.parse(activeArtifact.output_markdown);
                      if (Array.isArray(events)) {
                        noteContent = `### Dòng thời gian / Niên biểu\n\n` + 
                          `| Thời gian | Sự kiện | Chi tiết |\n| --- | --- | --- |\n` + 
                          events.map(ev => `| ${ev.date} | ${ev.event} | ${ev.detail} |`).join('\n');
                      }
                    } catch (e) {}
                  }
                  setActiveNote({
                    id: null,
                    title: activeArtifact.title,
                    content: noteContent
                  });
                  setIsEditingNote(true);
                  setActiveArtifact(null);
                }}
              >
                Lưu thành Ghi chú để chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Study Session Modal */}
      {activeStudySession && (() => {
        const { type, artifact, currentIndex, answers, flipped, score } = activeStudySession;
        const items = artifact.items || [];
        const currentItem = items[currentIndex];

        const handleCloseSession = () => {
          setActiveStudySession(null);
        };

        if (items.length === 0) {
          return (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox} style={{ maxWidth: '600px' }}>
                <div className={styles.modalHeaderBar}>
                  <div className={styles.modalTitle}>{artifact.title}</div>
                  <button className={styles.iconBtn} onClick={handleCloseSession} aria-label="Đóng"><X size={18} /></button>
                </div>
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <AlertTriangle size={32} style={{ color: 'var(--accent)', marginBottom: '12px' }} />
                  <div>Không tìm thấy nội dung học tập nào được sinh ra.</div>
                </div>
              </div>
            </div>
          );
        }

        const isCompleted = currentIndex >= items.length;

        if (isCompleted) {
          const totalItems = items.length;
          const scorePercent = type === 'quiz' ? Math.round((score / totalItems) * 100) : 0;
          return (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox} style={{ maxWidth: '500px', textAlign: 'center', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className={styles.iconBtn} onClick={handleCloseSession} aria-label="Đóng"><X size={18} /></button>
                </div>
                <div style={{ padding: '20px 0' }}>
                  <Award size={48} style={{ color: 'var(--accent)', margin: '0 auto 16px auto', display: 'block' }} />
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Chúc mừng bạn đã hoàn thành!</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                    Bạn đã đi hết toàn bộ bộ tài liệu {type === 'quiz' ? 'trắc nghiệm' : 'thẻ ghi nhớ'}.
                  </p>

                  {type === 'quiz' ? (
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>KẾT QUẢ ĐẠT ĐƯỢC</div>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: scorePercent >= 80 ? '#2ed573' : 'var(--accent)' }}>
                        {score} / {totalItems}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Tỷ lệ trả lời chính xác: {scorePercent}%
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>THẺ GHI NHỚ</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '8px' }}>
                        Toàn bộ {totalItems} thẻ đã được ôn tập thành công.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button 
                      className={`${styles.modalBtn} ${styles.modalBtnSecondary}`}
                      onClick={() => {
                        setActiveStudySession({
                          ...activeStudySession,
                          currentIndex: 0,
                          answers: {},
                          flipped: false,
                          score: 0
                        });
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={14} /> Học lại
                    </button>
                    <button 
                      className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                      onClick={handleCloseSession}
                    >
                      Hoàn thành
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (type === 'flashcards') {
          const card = currentItem.content;
          return (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox} style={{ maxWidth: '600px', height: '65vh', display: 'flex', flexDirection: 'column' }}>
                <div className={styles.modalHeaderBar}>
                  <div className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckSquare size={16} style={{ color: 'var(--accent)' }} />
                    {artifact.title}
                  </div>
                  <button className={styles.iconBtn} onClick={handleCloseSession} aria-label="Đóng"><X size={18} /></button>
                </div>

                <div style={{ padding: '12px 20px 0 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Tiến độ: {currentIndex} / {items.length} thẻ</span>
                    <span>{Math.round((currentIndex / items.length) * 100)}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(currentIndex / items.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                  <div 
                    className={`${styles.flashcardContainer} ${flipped ? styles.flashcardFlipped : ''}`}
                    onClick={() => setActiveStudySession({ ...activeStudySession, flipped: !flipped })}
                  >
                    <div className={styles.flashcard}>
                      <div className={styles.flashcardFront}>
                        <div className={styles.flashcardLabel}>MẶT TRƯỚC</div>
                        <div className={styles.flashcardText}>{card.front}</div>
                        <div className={styles.flashcardHint}>Bấm vào thẻ để xem đáp án</div>
                      </div>
                      <div className={styles.flashcardBack}>
                        <div className={styles.flashcardLabel}>MẶT SAU (ĐÁP ÁN)</div>
                        <div className={styles.flashcardText}>{card.back}</div>
                        <div className={styles.flashcardHint}>Bấm vào thẻ để xem câu hỏi</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooterBar} style={{ gap: '12px' }}>
                  <button
                    className={`${styles.modalBtn} ${styles.modalBtnSecondary}`}
                    onClick={() => {
                      if (currentIndex > 0) {
                        setActiveStudySession({
                          ...activeStudySession,
                          currentIndex: currentIndex - 1,
                          flipped: false
                        });
                      }
                    }}
                    disabled={currentIndex === 0}
                    style={{ marginRight: 'auto' }}
                  >
                    Quay lại
                  </button>

                  <button
                    className={`${styles.modalBtn}`}
                    onClick={async () => {
                      await handleUpdateStudyProgress(currentItem.id, 'incorrect', 0);
                      setActiveStudySession({
                        ...activeStudySession,
                        currentIndex: currentIndex + 1,
                        flipped: false
                      });
                    }}
                    style={{ background: 'rgba(235, 94, 85, 0.1)', color: '#ff4d4d', border: '1px solid rgba(235, 94, 85, 0.2)' }}
                    title="Không thể nhớ thẻ này, xếp vào đầu hàng đợi để ôn tập ngay"
                  >
                    Chưa thuộc
                  </button>

                  <button
                    className={`${styles.modalBtn}`}
                    onClick={async () => {
                      await handleUpdateStudyProgress(currentItem.id, 'correct', 1);
                      setActiveStudySession({
                        ...activeStudySession,
                        currentIndex: currentIndex + 1,
                        flipped: false
                      });
                    }}
                    style={{ background: 'rgba(255, 127, 80, 0.1)', color: '#ff7f50', border: '1px solid rgba(255, 127, 80, 0.2)' }}
                    title="Nhớ mang máng hoặc mất nhiều thời gian suy nghĩ"
                  >
                    Khó
                  </button>

                  <button
                    className={`${styles.modalBtn}`}
                    onClick={async () => {
                      await handleUpdateStudyProgress(currentItem.id, 'correct', 2);
                      setActiveStudySession({
                        ...activeStudySession,
                        currentIndex: currentIndex + 1,
                        flipped: false
                      });
                    }}
                    style={{ background: 'rgba(108, 92, 231, 0.1)', color: 'var(--accent)', border: '1px solid rgba(108, 92, 231, 0.2)' }}
                    title="Nhớ được sau một chút suy nghĩ ngắn"
                  >
                    Trung bình
                  </button>

                  <button
                    className={`${styles.modalBtn}`}
                    onClick={async () => {
                      await handleUpdateStudyProgress(currentItem.id, 'correct', 3);
                      setActiveStudySession({
                        ...activeStudySession,
                        currentIndex: currentIndex + 1,
                        flipped: false
                      });
                    }}
                    style={{ background: 'rgba(46, 213, 115, 0.1)', color: '#2ed573', border: '1px solid rgba(46, 213, 115, 0.2)' }}
                    title="Nhớ ra ngay lập tức và không cần cố gắng"
                  >
                    Dễ
                  </button>
                </div>
              </div>
            </div>
          );
        }

        if (type === 'quiz') {
          const question = currentItem.content;
          const selectedOptionIndex = answers[currentIndex];
          const hasAnswered = selectedOptionIndex !== undefined;
          const isCorrect = hasAnswered && selectedOptionIndex === question.answerIndex;

          const handleSelectOption = async (optionIndex) => {
            if (hasAnswered) return;
            const nextAnswers = { ...answers, [currentIndex]: optionIndex };
            const isCorrectAnswer = optionIndex === question.answerIndex;
            const nextScore = isCorrectAnswer ? score + 1 : score;

            await handleUpdateStudyProgress(currentItem.id, isCorrectAnswer ? 'correct' : 'incorrect', isCorrectAnswer ? 1 : 0);

            setActiveStudySession({
              ...activeStudySession,
              answers: nextAnswers,
              score: nextScore
            });
          };

          return (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox} style={{ maxWidth: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div className={styles.modalHeaderBar}>
                  <div className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={16} style={{ color: 'var(--accent)' }} />
                    {artifact.title}
                  </div>
                  <button className={styles.iconBtn} onClick={handleCloseSession} aria-label="Đóng"><X size={18} /></button>
                </div>

                <div style={{ padding: '12px 20px 0 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Câu hỏi: {currentIndex + 1} / {items.length}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!hasAnswered && (
                        <span 
                          style={{ 
                            background: quizTimer <= 10 ? 'rgba(235, 94, 85, 0.15)' : 'rgba(108, 92, 231, 0.15)', 
                            color: quizTimer <= 10 ? '#ff4d4d' : 'var(--accent)', 
                            border: `1px solid ${quizTimer <= 10 ? 'rgba(235, 94, 85, 0.3)' : 'rgba(108, 92, 231, 0.3)'}`,
                            padding: '2px 8px', 
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={11} /> {quizTimer}s còn lại
                        </span>
                      )}
                      <span>Điểm số: {score} đúng</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${((currentIndex + 1) / items.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '20px', lineHeight: '1.5' }}>
                    {currentIndex + 1}. {question.question}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {question.options.map((opt, idx) => {
                      let buttonStyle = {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: hasAnswered ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      };

                      if (hasAnswered) {
                        if (idx === question.answerIndex) {
                          buttonStyle.background = 'rgba(46, 213, 115, 0.1)';
                          buttonStyle.borderColor = '#2ed573';
                          buttonStyle.color = '#2ed573';
                          buttonStyle.fontWeight = '500';
                        } else if (idx === selectedOptionIndex) {
                          buttonStyle.background = 'rgba(235, 94, 85, 0.1)';
                          buttonStyle.borderColor = '#ff4d4d';
                          buttonStyle.color = '#ff4d4d';
                        } else {
                          buttonStyle.opacity = '0.5';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(idx)}
                          style={buttonStyle}
                          className={!hasAnswered ? styles.quizOptionBtn : ''}
                        >
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: '1px solid currentColor',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '600',
                            flexShrink: 0
                          }}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {hasAnswered && (
                    <div style={{
                      marginTop: '20px',
                      padding: '16px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: isCorrect ? '#2ed573' : 'var(--accent)',
                        marginBottom: '6px'
                      }}>
                        {isCorrect ? <Check size={16} /> : <X size={16} />}
                        {isCorrect ? 'Đáp án chính xác!' : 'Đáp án chưa chính xác!'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        <strong>Giải thích:</strong> {question.explanation}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.modalFooterBar}>
                  <button
                    className={`${styles.modalBtn} ${styles.modalBtnSecondary}`}
                    onClick={() => {
                      if (currentIndex > 0) {
                        setActiveStudySession({
                          ...activeStudySession,
                          currentIndex: currentIndex - 1
                        });
                      }
                    }}
                    disabled={currentIndex === 0}
                  >
                    Quay lại
                  </button>

                  <button
                    className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                    onClick={() => {
                      setActiveStudySession({
                        ...activeStudySession,
                        currentIndex: currentIndex + 1
                      });
                    }}
                    disabled={!hasAnswered}
                  >
                    {currentIndex === items.length - 1 ? 'Hoàn thành' : 'Câu tiếp theo'}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Deletion Dialog */}
      {deleteSourceId && (
        <ConfirmDialog
          isOpen={!!deleteSourceId}
          title="Delete Source Document"
          message={`Are you sure you want to permanently delete "${deleteSourceTitle}"? This will clean up its chunks and vector index mappings.`}
          onConfirm={handleDeleteSource}
          onCancel={() => setDeleteSourceId(null)}
        />
      )}

      {/* Mobile Tabs Bar */}
      <nav className={styles.mobileTabs}>
        <button 
          className={`${styles.mobileTab} ${mobileActiveTab === 'sources' ? styles.mobileTabActive : ''}`}
          onClick={() => setMobileActiveTab('sources')}
        >
          <BookOpen size={18} />
          <span>Sources</span>
        </button>
        <button 
          className={`${styles.mobileTab} ${mobileActiveTab === 'chat' ? styles.mobileTabActive : ''}`}
          onClick={() => setMobileActiveTab('chat')}
        >
          <MessageSquare size={18} />
          <span>Chat</span>
        </button>
        <button 
          className={`${styles.mobileTab} ${mobileActiveTab === 'studio' ? styles.mobileTabActive : ''}`}
          onClick={() => setMobileActiveTab('studio')}
        >
          <FileText size={18} />
          <span>Studio</span>
        </button>
      </nav>
    </div>
  );
}
