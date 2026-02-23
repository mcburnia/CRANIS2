import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, MessageSquare, Bug, Lightbulb, Loader2, CheckCircle2 } from 'lucide-react';
import './FeedbackModal.css';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'feedback', label: 'Feedback', icon: MessageSquare, color: 'var(--accent)' },
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'var(--red)' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'var(--amber)' },
];

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState('feedback');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { setError('Please fill in all fields'); return; }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject: subject.trim(), body: body.trim(), pageUrl: window.location.pathname }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setCategory('feedback');
        setSubject('');
        setBody('');
        onClose();
      }, 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return createPortal(
    <div className="fb-overlay" onClick={handleOverlayClick}>
      <div className="fb-modal">
        <div className="fb-header">
          <h3>Send Feedback</h3>
          <button className="fb-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {submitted ? (
          <div className="fb-success">
            <CheckCircle2 size={48} strokeWidth={1.5} />
            <h4>Thank you!</h4>
            <p>Your feedback has been submitted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fb-form">
            <div className="fb-categories">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  className={`fb-cat-btn ${category === cat.value ? 'active' : ''}`}
                  onClick={() => setCategory(cat.value)}
                  style={{ '--cat-color': cat.color } as React.CSSProperties}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="fb-input"
              placeholder="Subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={255}
              autoFocus
            />

            <textarea
              className="fb-textarea"
              placeholder={category === 'bug'
                ? 'Describe the bug: what happened, what you expected, and steps to reproduce...'
                : category === 'feature'
                ? 'Describe the feature you\'d like to see...'
                : 'Share your thoughts...'
              }
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
            />

            {error && <div className="fb-error">{error}</div>}

            <div className="fb-actions">
              <button type="button" className="fb-cancel-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="fb-submit-btn" disabled={submitting}>
                {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
