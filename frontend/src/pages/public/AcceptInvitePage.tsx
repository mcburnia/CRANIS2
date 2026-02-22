import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import './LoginPage.css';
import './SignupPage.css';

interface PasswordCheck {
  label: string;
  met: boolean;
}

function getPasswordStrength(password: string): { score: number; checks: PasswordCheck[] } {
  const checks: PasswordCheck[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains a number', met: /[0-9]/.test(password) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.met).length;
  return { score, checks };
}

function getStrengthLabel(score: number): { text: string; color: string } {
  if (score <= 1) return { text: 'Very weak', color: 'var(--red)' };
  if (score === 2) return { text: 'Weak', color: 'var(--red)' };
  if (score === 3) return { text: 'Fair', color: 'var(--amber)' };
  if (score === 4) return { text: 'Strong', color: 'var(--green)' };
  return { text: 'Very strong', color: 'var(--green)' };
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showChecks, setShowChecks] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { score, checks } = useMemo(() => getPasswordStrength(password), [password]);
  const strengthInfo = useMemo(() => getStrengthLabel(score), [score]);

  const passwordsMatch = password === confirmPassword;
  const confirmTouched = confirmPassword.length > 0;

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="logo">CRANIS<span>2</span></div>
          <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <h2>Invalid Invitation Link</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
              This invitation link is missing or malformed. Please check the link from your email or contact your administrator.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (score < 4) {
      setError('Password is not strong enough');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to activate account');
        return;
      }

      // Store session and redirect
      localStorage.setItem('session_token', data.session);
      if (data.hasOrg) {
        navigate('/dashboard');
      } else {
        navigate('/welcome');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo">CRANIS<span>2</span></div>
        <div className="subtitle">CRA compliance for your software organisation</div>
        <div className="auth-card">
          <h2>Set Up Your Account</h2>
          <p>You've been invited to CRANIS2. Choose a password to get started.</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Create a password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setShowChecks(true)}
                required
              />
              {password.length > 0 && (
                <div className="password-strength">
                  <div className="strength-bar">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="strength-segment"
                        style={{
                          background: i <= score ? strengthInfo.color : 'var(--border)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="strength-label" style={{ color: strengthInfo.color }}>
                    {strengthInfo.text}
                  </span>
                </div>
              )}
              {showChecks && (
                <ul className="password-checks">
                  {checks.map((check) => (
                    <li key={check.label} className={check.met ? 'met' : ''}>
                      <span className="check-icon">{check.met ? '\u2713' : '\u2717'}</span>
                      {check.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                className={`form-input ${confirmTouched && !passwordsMatch ? 'input-error' : ''} ${confirmTouched && passwordsMatch && password.length > 0 ? 'input-success' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmTouched && !passwordsMatch && (
                <div className="field-error">Passwords do not match</div>
              )}
              {confirmTouched && passwordsMatch && password.length > 0 && (
                <div className="field-success">Passwords match</div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={score < 4 || !passwordsMatch || !confirmTouched || loading}
            >
              {loading ? 'Activating account...' : 'Activate Account'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
