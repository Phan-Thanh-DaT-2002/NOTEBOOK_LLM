'use client';
import React from 'react';

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card glass-panel">
          <div className="skeleton-line title" />
          <div className="skeleton-line text" />
          <div className="skeleton-line text short" />
          <div className="skeleton-footer">
            <div className="skeleton-avatar" />
            <div className="skeleton-line text tiny" />
          </div>
        </div>
      ))}

      <style jsx>{`
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          width: 100%;
        }

        .skeleton-card {
          padding: 20px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: 180px;
        }

        .skeleton-line {
          height: 14px;
          background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: var(--radius-sm);
        }

        .skeleton-line.title {
          height: 20px;
          width: 70%;
          margin-bottom: 8px;
        }

        .skeleton-line.text {
          width: 100%;
        }

        .skeleton-line.text.short {
          width: 60%;
        }

        .skeleton-line.text.tiny {
          width: 40%;
          height: 10px;
        }

        .skeleton-footer {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .skeleton-avatar {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-pill);
          background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }

        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function ListSkeleton({ count = 4 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-avatar square" />
          <div className="skeleton-info">
            <div className="skeleton-line title" />
            <div className="skeleton-line text" />
          </div>
        </div>
      ))}

      <style jsx>{`
        .skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .skeleton-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }

        .skeleton-avatar.square {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          flex-shrink: 0;
        }

        .skeleton-info {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .skeleton-line {
          height: 12px;
          background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: var(--radius-sm);
        }

        .skeleton-line.title {
          height: 14px;
          width: 40%;
        }

        .skeleton-line.text {
          width: 90%;
        }

        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function TextSkeleton({ lines = 3 }) {
  return (
    <div className="skeleton-text-container">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton-text-line ${i === lines - 1 ? 'last' : ''}`}
        />
      ))}

      <style jsx>{`
        .skeleton-text-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .skeleton-text-line {
          height: 14px;
          width: 100%;
          background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: var(--radius-sm);
        }

        .skeleton-text-line.last {
          width: 70%;
        }

        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
