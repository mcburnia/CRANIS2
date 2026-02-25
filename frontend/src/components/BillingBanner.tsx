import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import './BillingBanner.css';

interface BillingBannerData {
  status: string;
  trialDaysRemaining: number | null;
  graceEndsAt: string | null;
  exempt: boolean;
}

export default function BillingBanner() {
  const [data, setData] = useState<BillingBannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) return;

    fetch('/api/billing/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {}); // Silently fail — banner is non-critical
  }, []);

  if (dismissed || !data || data.exempt) return null;

  const { status, trialDaysRemaining, graceEndsAt } = data;

  // No banner needed for active or none
  if (['active', 'none', 'exempt'].includes(status)) return null;

  // Trial with plenty of days left — no banner
  if (status === 'trial' && !graceEndsAt && (trialDaysRemaining === null || trialDaysRemaining > 14)) return null;

  let severity: 'info' | 'warning' | 'error' = 'info';
  let message = '';

  if (status === 'trial' && graceEndsAt) {
    severity = 'error';
    message = 'Your trial has ended. Subscribe now to keep full access.';
  } else if (status === 'trial' && trialDaysRemaining !== null) {
    severity = trialDaysRemaining <= 7 ? 'warning' : 'info';
    message = `Your free trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}. Upgrade to continue.`;
  } else if (status === 'past_due') {
    severity = 'warning';
    message = 'Your last payment failed. Update your payment method to avoid service interruption.';
  } else if (status === 'read_only') {
    severity = 'error';
    message = 'Your account is in read-only mode due to a billing issue.';
  } else if (status === 'suspended') {
    severity = 'error';
    message = 'Your account is suspended. Subscribe to restore access.';
  } else if (status === 'cancelled') {
    severity = 'warning';
    message = 'Your subscription has been cancelled. Resubscribe to maintain access.';
  } else {
    return null;
  }

  return (
    <div className={`billing-banner billing-banner-${severity}`}>
      <AlertTriangle size={16} />
      <span>{message}</span>
      <button className="billing-banner-action" onClick={() => navigate('/billing')}>
        {status === 'trial' ? 'Upgrade' : 'Manage Billing'}
      </button>
      <button className="billing-banner-close" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
