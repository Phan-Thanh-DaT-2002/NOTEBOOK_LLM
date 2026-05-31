'use client';

import React from 'react';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

export default function TimelineView({ events }) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
        Không tìm thấy dòng thời gian hợp lệ.
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'relative',
        padding: '10px 0 20px 0',
        width: '100%',
        margin: '0 auto',
        maxWidth: '650px'
      }}
    >
      {/* Central continuous vertical timeline line */}
      <div 
        style={{
          position: 'absolute',
          left: '16px',
          top: '24px',
          bottom: '24px',
          width: '2px',
          background: 'linear-gradient(to bottom, var(--accent, #6c5ce7) 0%, rgba(108, 92, 231, 0.2) 100%)',
          borderRadius: '1px'
        }}
      />

      {/* Event Cards loop */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {events.map((item, index) => (
          <div 
            key={index} 
            style={{
              display: 'flex',
              position: 'relative',
              paddingLeft: '36px',
              animation: `fadeInUp 0.4s ease forwards ${index * 0.08}s`,
              opacity: 0,
              transform: 'translateY(10px)'
            }}
          >
            {/* Event connector dot indicator */}
            <div 
              style={{
                position: 'absolute',
                left: '9px',
                top: '6px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'var(--bg-surface, #1e1e30)',
                border: '3px solid var(--accent, #6c5ce7)',
                boxShadow: '0 0 10px rgba(108, 92, 231, 0.4)',
                zIndex: 2,
                transition: 'transform 0.2s ease'
              }}
              className="timeline-dot"
            />

            {/* Content card */}
            <div 
              style={{
                background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: '12px',
                padding: '16px',
                width: '100%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
              }}
              className="timeline-card"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'rgba(108, 92, 231, 0.3)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                const dot = e.currentTarget.parentNode.querySelector('.timeline-dot');
                if (dot) dot.style.transform = 'scale(1.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.08))';
                e.currentTarget.style.background = 'var(--bg-surface, rgba(255, 255, 255, 0.03))';
                const dot = e.currentTarget.parentNode.querySelector('.timeline-dot');
                if (dot) dot.style.transform = 'none';
              }}
            >
              {/* Date Header */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--accent, #6c5ce7)',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '6px'
                }}
              >
                <Clock size={12} />
                <span>{item.date || 'Không rõ thời gian'}</span>
              </div>

              {/* Event Name */}
              <h4 
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#ffffff',
                  marginBottom: '6px',
                  lineHeight: '1.4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {item.event}
              </h4>

              {/* Event Details */}
              <p 
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-secondary, #b2bec3)',
                  lineHeight: '1.5',
                  margin: 0
                }}
              >
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Inject animation rule directly */}
      <style jsx global>{`
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
