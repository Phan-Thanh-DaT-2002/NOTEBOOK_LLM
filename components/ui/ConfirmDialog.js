'use client';
import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = true,
}) {
  // Prevent scrolling behind the modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="confirm-header">
          <div className={`confirm-icon ${isDestructive ? 'icon-destructive' : 'icon-info'}`}>
            <AlertTriangle size={20} />
          </div>
          <h3>{title}</h3>
        </div>
        <div className="confirm-body">
          <p>{message}</p>
        </div>
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn-primary ${isDestructive ? 'btn-destructive' : 'btn-accent'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        .confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 200ms ease-out forwards;
        }

        .confirm-modal {
          width: 90%;
          max-width: 440px;
          padding: 24px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          animation: scaleUp 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .confirm-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .confirm-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
        }

        .icon-destructive {
          background: rgba(225, 112, 85, 0.15);
          color: var(--error);
        }

        .icon-info {
          background: rgba(108, 92, 231, 0.15);
          color: var(--accent);
        }

        .confirm-body p {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        button {
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          border-radius: var(--radius-md);
          border: none;
          cursor: pointer;
          transition: background var(--transition-fast), transform var(--transition-fast);
        }

        button:active {
          transform: scale(0.98);
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover {
          background: var(--border);
        }

        .btn-destructive {
          background: var(--error);
          color: #ffffff;
        }

        .btn-destructive:hover {
          background: #d63031;
        }

        .btn-accent {
          background: var(--accent);
          color: #ffffff;
        }

        .btn-accent:hover {
          background: var(--accent-hover);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
