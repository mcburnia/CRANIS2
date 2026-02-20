import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function WelcomePage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const session = searchParams.get('session');
    if (session) {
      localStorage.setItem('session_token', session);
      // Clean the URL
      window.history.replaceState({}, '', '/welcome');
    }
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ textAlign: 'center', maxWidth: '540px' }}>
        <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '2rem' }}>
          CRANIS<span style={{ color: 'var(--accent)' }}>2</span>
        </div>

        <div className="auth-card" style={{ padding: '2.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <CheckCircle size={56} color="var(--green)" />
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Welcome to CRANIS2!
          </h1>

          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '2rem' }}>
            Your email has been verified and your account is ready.
            Let's get your organisation set up so you can start tracking
            CRA compliance across your software products.
          </p>

          <Link
            to="/setup/org"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            Set Up Your Organisation <ArrowRight size={18} />
          </Link>

          <div style={{ marginTop: '1.5rem' }}>
            <Link
              to="/dashboard"
              style={{ color: 'var(--muted)', fontSize: '0.85rem' }}
            >
              Skip for now and go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
