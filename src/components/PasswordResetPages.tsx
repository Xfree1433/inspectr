import { useEffect, useState, type ReactNode } from 'react';
import { passwordApi } from '../api/client';
import { clearResetToken, getResetToken } from '../resetToken';

// "Forgot password?" and "Choose a new password" screens. Same card as the
// sign-in page (LoginPage.tsx).

const MIN_PASSWORD_LENGTH = 6; // same as sign-up; the server enforces it too
const GENERIC_MESSAGE = "If an account exists for that address, we've emailed a reset link. It works for 1 hour.";

function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1f5f9',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '2rem',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #dc2626, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 0.75rem',
          }}>🔍</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', margin: 0 }}>INSPECTR</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await passwordApi.forgot(email);
      if (res.ok) setSent(res.data.message || GENERIC_MESSAGE);
      else setError(res.data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard subtitle="Reset your password">
      {sent ? (
        <p style={noticeStyle}>{sent}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ color: '#374151', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
            Enter the email you sign in with and we'll send you a link to choose a new password.
          </p>
          <input
            type="email" placeholder="Email" value={email} autoComplete="email"
            onChange={e => setEmail(e.target.value)} required
            style={inputStyle}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Sending...' : 'Email me a reset link'}
          </button>
        </form>
      )}
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6b7280', marginTop: '1rem' }}>
        <button onClick={onBack} style={linkStyle}>Back to sign in</button>
      </p>
    </AuthCard>
  );
}

export function ResetPasswordPage({ onSignIn, onRequestNew }: { onSignIn: () => void; onRequestNew: () => void }) {
  const [token] = useState(getResetToken);
  const [state, setState] = useState<'checking' | 'invalid' | 'form' | 'done'>(token ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Read-only check that the link is still good; it consumes nothing.
  useEffect(() => {
    if (!token) return;
    let live = true;
    passwordApi.verify(token)
      .then(res => { if (live) setState(res.ok ? 'form' : 'invalid'); })
      .catch(() => { if (live) setState('form'); }); // network blip: let the submit decide
    return () => { live = false; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await passwordApi.reset(token || '', password, confirm);
      if (res.ok) {
        clearResetToken();
        setState('done');
      } else if ((res.data as { code?: string }).code === 'invalid_token') {
        clearResetToken();
        setState('invalid');
      } else {
        setError(res.data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (state === 'checking') {
    return <AuthCard subtitle="Choose a new password"><p style={noticeStyle}>Checking your link...</p></AuthCard>;
  }

  if (state === 'invalid') {
    return (
      <AuthCard subtitle="Choose a new password">
        <p style={errorStyle}>This reset link is invalid or has expired. Links work for 1 hour and only once.</p>
        <button onClick={() => { clearResetToken(); onRequestNew(); }} style={buttonStyle}>Request a new link</button>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6b7280', marginTop: '1rem' }}>
          <button onClick={() => { clearResetToken(); onSignIn(); }} style={linkStyle}>Back to sign in</button>
        </p>
      </AuthCard>
    );
  }

  if (state === 'done') {
    return (
      <AuthCard subtitle="Password changed">
        <p style={noticeStyle}>Your password has been changed. Sign in with your new password.</p>
        <button onClick={onSignIn} style={buttonStyle}>Go to sign in</button>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Choose a new password">
      <form onSubmit={handleSubmit}>
        <input
          type="password" placeholder="New password" value={password} autoComplete="new-password"
          onChange={e => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH}
          style={inputStyle}
        />
        <input
          type="password" placeholder="Confirm new password" value={confirm} autoComplete="new-password"
          onChange={e => setConfirm(e.target.value)} required minLength={MIN_PASSWORD_LENGTH}
          style={inputStyle}
        />
        {error && <p style={errorStyle}>{error}</p>}
        <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Saving...' : 'Set new password'}
        </button>
      </form>
    </AuthCard>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: '0.875rem',
  marginBottom: '0.75rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem',
  border: 'none',
  borderRadius: 8,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  background: '#111',
  color: '#fff',
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  fontSize: '0.8rem',
  textDecoration: 'underline',
  padding: 0,
};

const noticeStyle: React.CSSProperties = { color: '#374151', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 1rem' };
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0' };
