'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setError('Vui lòng nhập API Key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Set the authentication cookie
      document.cookie = `notebook_auth=${keyInput.trim()}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;
      
      // Redirect to home
      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Đã có lỗi xảy ra. Hãy thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glow} />
      
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.iconContainer}>
            <KeyRound size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={styles.title}>Notebook LLM</h1>
          <p style={styles.subtitle}>Nhập API Key được cấu hình để truy cập từ xa</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputWrapper}>
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="Nhập API Key của bạn..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={styles.eyeButton}
              title={showKey ? 'Ẩn' : 'Hiện'}
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Đang xác thực...' : 'Truy cập'}
            {!loading && <ArrowRight size={16} style={styles.arrow} />}
          </button>
        </form>

        <div style={styles.footer}>
          <span>Bảo mật bởi Cloudflare Tunnel</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  glow: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(108, 92, 231, 0.15) 0%, rgba(0,0,0,0) 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px 30px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-glass)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '8px',
  },
  iconContainer: {
    width: '56px',
    height: '56px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px',
    border: '1px solid rgba(108, 92, 231, 0.2)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '14px 44px 14px 16px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
  },
  error: {
    fontSize: '13px',
    color: 'var(--error)',
    textAlign: 'left',
    paddingLeft: '4px',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-gradient)',
    border: 'none',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'transform var(--transition-fast), filter var(--transition-fast)',
    boxShadow: '0 4px 12px rgba(108, 92, 231, 0.3)',
  },
  arrow: {
    transition: 'transform var(--transition-fast)',
  },
  footer: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
};
