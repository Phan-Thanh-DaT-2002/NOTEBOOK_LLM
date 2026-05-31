'use client';
import React from 'react';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="empty-container">
      {Icon && (
        <div className="empty-icon-wrapper">
          <Icon size={40} className="empty-icon" />
        </div>
      )}
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {action && <div className="empty-action">{action}</div>}

      <style jsx>{`
        .empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 24px;
          height: 100%;
          min-height: 250px;
          color: var(--text-secondary);
        }

        .empty-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: var(--radius-pill);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          margin-bottom: 20px;
        }

        .empty-icon {
          color: var(--text-muted);
        }

        .empty-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .empty-description {
          font-size: 14px;
          max-width: 320px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .empty-action {
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
