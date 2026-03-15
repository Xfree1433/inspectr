import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, register, demoLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, name, companyName });
      }
    } catch {
      setError(mode === 'login' ? 'Invalid email or password' : 'Registration failed. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      await demoLogin();
    } catch {
      setError('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

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
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <input
                type="text" placeholder="Full Name" value={name}
                onChange={e => setName(e.target.value)} required
                style={inputStyle}
              />
              <input
                type="text" placeholder="Company Name" value={companyName}
                onChange={e => setCompanyName(e.target.value)} required
                style={inputStyle}
              />
            </>
          )}
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            style={inputStyle}
          />
          {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            ...buttonStyle,
            background: '#111',
            color: '#fff',
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '1rem 0', color: '#9ca3af', fontSize: '0.75rem' }}>or</div>

        <button onClick={handleDemo} disabled={loading} style={{
          ...buttonStyle,
          background: 'linear-gradient(135deg, #dc2626, #f97316)',
          color: '#fff',
          opacity: loading ? 0.6 : 1,
        }}>
          Try Demo
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6b7280', marginTop: '1rem' }}>
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setMode('register'); setError(''); }} style={linkStyle}>Register</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('login'); setError(''); }} style={linkStyle}>Sign In</button></>
          )}
        </p>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem' }}>
          <a href="https://store.plainspokenfoundrynine.com" style={{ color: '#6b7280', textDecoration: 'underline' }}>Back to Store</a>
        </p>
      </div>
    </div>
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
