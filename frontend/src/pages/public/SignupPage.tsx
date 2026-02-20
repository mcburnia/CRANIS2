import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showChecks, setShowChecks] = useState(false);
  const [error, setError] = useState('');

  const { score, checks } = useMemo(() => getPasswordStrength(password), [password]);
  const strengthInfo = useMemo(() => getStrengthLabel(score), [score]);

  const passwordsMatch = password === confirmPassword;
  const confirmTouched = confirmPassword.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }
    if (score < 4) {
      setError('Password is not strong enough');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    // TODO: call registration API
    navigate('/setup/org');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo">CRANIS<span>2</span></div>
        <div className="subtitle">CRA compliance for your software organisation</div>
        <div className="auth-card">
          <h2>Create your account</h2>
          <p>Get started with your email address</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

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
              disabled={!email || score < 4 || !passwordsMatch || !confirmTouched}
            >
              Create Account
            </button>
          </form>

          <div className="divider"><span>or</span></div>

          <button className="github-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Sign up with GitHub
          </button>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
