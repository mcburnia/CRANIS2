import { useLocation, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function CheckEmailPage() {
  const location = useLocation();
  const email = (location.state as { email?: string })?.email || 'your email';

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ textAlign: 'center' }}>
        <div className="logo">CRANIS<span>2</span></div>
        <div className="auth-card" style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Mail size={48} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Check your email
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            We've sent a verification link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
            Click the link in the email to verify your account and get started.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            The link expires in 24 hours. Check your spam folder if you don't see it.
          </p>
          <Link to="/login" className="btn btn-outline" style={{ display: 'inline-block' }}>
            Back to Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
