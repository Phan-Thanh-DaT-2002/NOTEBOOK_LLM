'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Cpu, Key, Link as LinkIcon, Check, AlertCircle, Save, Loader2 
} from 'lucide-react';
import styles from './settings.module.css';
import { useToast } from '@/components/ui/Toast.js';
import { TextSkeleton } from '@/components/ui/LoadingSkeleton.js';

export default function Settings() {
  const router = useRouter();
  const toast = useToast();

  // Settings states
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [chatModel, setChatModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [ttsProvider, setTtsProvider] = useState('browser');
  const [theme, setTheme] = useState('dark');

  // Available models list (fetched on test/load)
  const [availableModels, setAvailableModels] = useState([]);
  
  // Action states
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/settings');
        const json = await res.json();

        if (json.ok && json.data) {
          const d = json.data;
          setProvider(d.provider || 'ollama');
          setApiKey(d.apiKey ? '••••••••••••••••' : '');
          setOllamaUrl(d.ollamaUrl || 'http://localhost:11434');
          setChatModel(d.chatModel || '');
          setEmbeddingModel(d.embeddingModel || '');
          setTtsProvider(d.ttsProvider || 'browser');
          setTheme(d.theme || 'dark');
        } else {
          toast.error('Failed to load settings');
        }
      } catch (err) {
        console.error(err);
        toast.error('Network error loading settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  // Fetch available models for the selected provider
  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey === '••••••••••••••••' ? undefined : apiKey, // Undefined lets backend reuse existing key
          ollamaUrl,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        setTestResult({
          success: true,
          message: `Connected successfully! Found ${json.data.models?.length || 0} models.`,
        });
        setAvailableModels(json.data.models || []);
        
        // Auto-select models if currently empty
        if (json.data.models && json.data.models.length > 0) {
          if (!chatModel) {
            // Find a chat model
            const chatM = json.data.models.find(m => !m.includes('embed')) || json.data.models[0];
            setChatModel(chatM);
          }
          if (!embeddingModel) {
            // Find an embedding model
            const embedM = json.data.models.find(m => m.includes('embed')) || json.data.models[0];
            setEmbeddingModel(embedM);
          }
        }
        
        toast.success('Connection test successful!');
      } else {
        setTestResult({
          success: false,
          message: json.error?.message || 'Connection failed',
        });
        toast.error(json.error?.message || 'Connection test failed');
      }
    } catch (err) {
      console.error(err);
      setTestResult({
        success: false,
        message: 'Network request failed. Make sure server is reachable.',
      });
      toast.error('Network error during connection test');
    } finally {
      setTesting(false);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          ollamaUrl,
          chatModel,
          embeddingModel,
          ttsProvider,
          theme,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success('Settings saved successfully!');
        
        // Update document theme if changed
        document.documentElement.setAttribute('data-theme', theme);
        
        // Redirect back to dashboard after brief delay
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        toast.error(json.error?.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.btnBack} onClick={() => router.push('/')} aria-label="Go Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.title}>System Settings</h1>
      </header>

      {/* Main Settings Card */}
      {loading ? (
        <div className={`${styles.card} glass-panel`}>
          <TextSkeleton lines={6} />
        </div>
      ) : (
        <div className={`${styles.card} glass-panel`}>
          {/* Provider Selection */}
          <div className={styles.formGroup}>
            <label>Model Provider</label>
            <div className={styles.providerSelect}>
              {['ollama', 'openai', 'gemini', 'anthropic'].map(p => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.providerBtn} ${provider === p ? styles.providerBtnActive : ''}`}
                  onClick={() => {
                    setProvider(p);
                    setApiKey('');
                    setAvailableModels([]);
                    setTestResult(null);
                  }}
                >
                  <Cpu size={20} />
                  <span style={{ textTransform: 'capitalize' }}>{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Provider Parameters */}
          {provider === 'ollama' ? (
            <div className={styles.formGroup}>
              <label htmlFor="ollama-url">Ollama API URL</label>
              <div className={styles.inputWrapper}>
                <LinkIcon className={styles.inputIcon} size={16} />
                <input
                  id="ollama-url"
                  type="text"
                  className={`${styles.formInput} ${styles.formInputWithIcon}`}
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="E.g., http://localhost:11434"
                />
              </div>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label htmlFor="api-key">API Key</label>
              <div className={styles.inputWrapper}>
                <Key className={styles.inputIcon} size={16} />
                <input
                  id="api-key"
                  type="password"
                  className={`${styles.formInput} ${styles.formInputWithIcon}`}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={apiKey === '••••••••••••••••' ? '••••••••••••••••' : `Enter your ${provider} API key`}
                />
              </div>
            </div>
          )}

          {/* Connection Test Trigger */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <button 
                type="button" 
                className={styles.btnTest} 
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : null}
                Test Connection & Load Models
              </button>
            </div>

            {/* Test result status display */}
            {testResult && (
              <div className={`${styles.testResult} ${testResult.success ? styles.testSuccess : styles.testError}`}>
                {testResult.success ? <Check size={18} /> : <AlertCircle size={18} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Model Selection section */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label htmlFor="chat-model">Default Chat Model</label>
              {availableModels.length > 0 ? (
                <select
                  id="chat-model"
                  className={styles.formSelect}
                  value={chatModel}
                  onChange={e => setChatModel(e.target.value)}
                >
                  <option value="">-- Select Chat Model --</option>
                  {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="chat-model"
                  type="text"
                  className={styles.formInput}
                  value={chatModel}
                  onChange={e => setChatModel(e.target.value)}
                  placeholder="E.g., qwen2.5:7b, gpt-4o-mini..."
                />
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="embedding-model">Default Embedding Model</label>
              {availableModels.length > 0 ? (
                <select
                  id="embedding-model"
                  className={styles.formSelect}
                  value={embeddingModel}
                  onChange={e => setEmbeddingModel(e.target.value)}
                >
                  <option value="">-- Select Embedding Model --</option>
                  {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="embedding-model"
                  type="text"
                  className={styles.formInput}
                  value={embeddingModel}
                  onChange={e => setEmbeddingModel(e.target.value)}
                  placeholder="E.g., nomic-embed-text, text-embedding-3-small..."
                />
              )}
            </div>
          </div>

          {/* App Preferences */}
          <h3 className={styles.sectionTitle}>App Preferences</h3>
          
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label htmlFor="tts-provider">TTS Voice Overview Provider</label>
              <select
                id="tts-provider"
                className={styles.formSelect}
                value={ttsProvider}
                onChange={e => setTtsProvider(e.target.value)}
              >
                <option value="browser">Browser Native Speech (Web Speech API)</option>
                <option value="openai">OpenAI TTS API (Cloud)</option>
                <option value="kokoro">Kokoro/Piper (Local Server - V2)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="theme-select">Visual Theme</label>
              <select
                id="theme-select"
                className={styles.formSelect}
                value={theme}
                onChange={e => setTheme(e.target.value)}
              >
                <option value="dark">Dark Theme (Default)</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </div>

          {/* Footer Save Action */}
          <div className={styles.actions}>
            <button 
              type="button" 
              className={styles.btnSave} 
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save & Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
