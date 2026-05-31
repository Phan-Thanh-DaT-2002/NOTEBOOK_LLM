'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, Grid, List, Settings, Trash2, Calendar, BookOpen, X 
} from 'lucide-react';
import styles from './dashboard.module.css';
import { useToast } from '@/components/ui/Toast.js';
import ConfirmDialog from '@/components/ui/ConfirmDialog.js';
import EmptyState from '@/components/ui/EmptyState.js';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton.js';

export default function Dashboard() {
  const router = useRouter();
  const toast = useToast();
  
  // State variables
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updated_at'); // 'updated_at' or 'title'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Delete dialog state
  const [deleteNotebookId, setDeleteNotebookId] = useState(null);
  const [deleteNotebookTitle, setDeleteNotebookTitle] = useState('');

  // Fetch all notebooks
  const fetchNotebooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notebooks');
      const json = await res.json();
      
      if (json.ok) {
        setNotebooks(json.data);
      } else {
        toast.error(json.error?.message || 'Failed to load notebooks');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error loading notebooks');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  // Handle notebook creation
  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.warning('Notebook title is required');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          custom_instructions: customInstructions.trim(),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success(`Notebook "${json.data.title}" created!`);
        setIsCreateOpen(false);
        setNewTitle('');
        setCustomInstructions('');
        // Refresh and redirect to workspace
        router.push(`/notebook/${json.data.id}`);
      } else {
        toast.error(json.error?.message || 'Failed to create notebook');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error creating notebook');
    } finally {
      setCreating(false);
    }
  };

  // Trigger notebook deletion
  const triggerDelete = (e, id, title) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteNotebookId(id);
    setDeleteNotebookTitle(title);
  };

  // Perform deletion
  const handleDeleteNotebook = async () => {
    if (!deleteNotebookId) return;

    try {
      const res = await fetch(`/api/notebooks/${deleteNotebookId}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (json.ok) {
        toast.success('Notebook deleted successfully');
        setNotebooks(prev => prev.filter(n => n.id !== deleteNotebookId));
      } else {
        toast.error(json.error?.message || 'Failed to delete notebook');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error deleting notebook');
    } finally {
      setDeleteNotebookId(null);
      setDeleteNotebookTitle('');
    }
  };

  // Filter and sort notebooks list
  const filteredAndSortedNotebooks = useMemo(() => {
    let list = notebooks.filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    list.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // default: updated_at DESC
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    return list;
  }, [notebooks, searchQuery, sortBy]);

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoSection}>
          <BookOpen className={styles.logoIcon} size={28} />
          <h1 className={styles.logoTitle}>Local Notebook AI</h1>
        </div>
        <div className={styles.navActions}>
          <Link href="/settings" className={styles.btnLink}>
            <Settings size={16} />
            Settings
          </Link>
          <button 
            className={styles.btnPrimary}
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={16} />
            New Notebook
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <input
            type="text"
            placeholder="Search notebooks..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className={styles.filterControls}>
          <select
            className={styles.selectInput}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="updated_at">Last Modified</option>
            <option value="title">Title (A-Z)</option>
          </select>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid/List */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : filteredAndSortedNotebooks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={searchQuery ? "No matching notebooks" : "No notebooks yet"}
          description={
            searchQuery 
              ? "Try adjusting your search terms or keywords." 
              : "Create a notebook to start uploading sources, asking questions, and generating study notes."
          }
          action={
            !searchQuery && (
              <button 
                className={styles.btnPrimary}
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus size={16} />
                Create Notebook
              </button>
            )
          }
        />
      ) : (
        <div className={viewMode === 'grid' ? styles.grid : styles.list}>
          {filteredAndSortedNotebooks.map(notebook => (
            <div 
              key={notebook.id}
              onClick={() => router.push(`/notebook/${notebook.id}`)}
              className={`${styles.card} ${styles.btnSecondary} glass-panel ${viewMode === 'list' ? styles.listItem : ''}`}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{notebook.title}</h3>
                <button
                  className={styles.btnDelete}
                  onClick={(e) => triggerDelete(e, notebook.id, notebook.title)}
                  title="Delete Notebook"
                  aria-label={`Delete ${notebook.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className={styles.cardFooter}>
                <div className={styles.cardMeta}>
                  <Calendar size={12} />
                  <span suppressHydrationWarning>{formatDate(notebook.updated_at)}</span>
                </div>
                {notebook.chat_model && (
                  <span className={styles.cardModelBadge}>
                    {notebook.chat_model}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
          <div className={`${styles.modal} glass-panel`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>New Notebook</h2>
              <button className={styles.modalClose} onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateNotebook}>
              <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                <label htmlFor="notebook-title">Notebook Title</label>
                <input
                  id="notebook-title"
                  type="text"
                  placeholder="E.g., World War II History, Physics 101 Study Guide..."
                  className={styles.formInput}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '24px' }}>
                <label htmlFor="custom-instructions">Custom AI Instructions (Optional)</label>
                <textarea
                  id="custom-instructions"
                  placeholder="Explain concepts simply, focus on timelines, use markdown formatting, etc."
                  className={styles.formTextarea}
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                />
              </div>
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.btnLink} 
                  onClick={() => setIsCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.btnPrimary}
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteNotebookId !== null}
        title="Delete Notebook?"
        message={`Are you sure you want to delete "${deleteNotebookTitle}"? This will permanently delete the notebook, uploaded sources, chunks, chat messages, notes, and study progress. This action cannot be undone.`}
        confirmText={creating ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        onConfirm={handleDeleteNotebook}
        onCancel={() => {
          setDeleteNotebookId(null);
          setDeleteNotebookTitle('');
        }}
        isDestructive={true}
      />
    </div>
  );
}
