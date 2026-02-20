import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');
  const session = searchParams.get('session');

  useEffect(() => {
    // If we have a session token, verification was done server-side and we were redirected
    if (session) {
      localStorage.setItem('session_token', session);
      window.location.href = '/welcome';
      return;
    }

    // If we have a verification token, call the API
    if (token) {
      // The backend GET /api/auth/verify-email will redirect us to /welcome?session=xxx
      // So we just redirect the browser there
      window.location.href = `/api/auth/verify-email?token=${token}`;
      return;
    }

    setStatus('error');
    setMessage('Invalid verification link');
  }, [token, session]);

  if (status === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div className="logo">CRANIS<span>2</span></div>
          <div className="auth-card" style={{ marginTop: '2rem' }}>
            <Loader size={48} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Verifying your email...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div className="logo">CRANIS<span>2</span></div>
          <div className="auth-card" style={{ marginTop: '2rem' }}>
            <XCircle size={48} color="var(--red)" />
            <h2 style={{ fontSize: '1.3rem', marginTop: '1rem', marginBottom: '0.5rem' }}>Verification Failed</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</p>
            <Link to="/signup" className="btn btn-primary">Try Again</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ textAlign: 'center' }}>
        <div className="logo">CRANIS<span>2</span></div>
        <div className="auth-card" style={{ marginTop: '2rem' }}>
          <CheckCircle size={48} color="var(--green)" />
          <h2 style={{ fontSize: '1.3rem', marginTop: '1rem' }}>Email Verified!</h2>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Redirecting you...</p>
        </div>
      </div>
    </div>
  );
}
