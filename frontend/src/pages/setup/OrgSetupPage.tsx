import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Building2, ArrowRight, Globe, Users, Shield, Factory } from 'lucide-react';
import './OrgSetupPage.css';

const EU_COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
  'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta',
  'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia',
  'Spain', 'Sweden',
  '──── EEA ────',
  'Iceland', 'Liechtenstein', 'Norway',
  '──── Other ────',
  'Switzerland', 'United Kingdom', 'Other',
];

const COMPANY_SIZES = [
  { value: 'micro', label: 'Micro', desc: 'Fewer than 10 employees' },
  { value: 'small', label: 'Small', desc: '10–49 employees' },
  { value: 'medium', label: 'Medium', desc: '50–249 employees' },
  { value: 'large', label: 'Large', desc: '250+ employees' },
];

const CRA_ROLES = [
  { value: 'manufacturer', label: 'Manufacturer', desc: 'You design or develop products with digital elements', icon: Factory },
  { value: 'importer', label: 'Importer', desc: 'You bring third-party products into the EU market', icon: Globe },
  { value: 'distributor', label: 'Distributor', desc: 'You make products available on the EU market', icon: Users },
  { value: 'open_source_steward', label: 'Open Source Steward', desc: 'You systematically provide open-source software for commercial use', icon: Shield },
];

const INDUSTRIES = [
  'Automotive', 'Aerospace & Defence', 'Consumer Electronics',
  'Energy & Utilities', 'Financial Services', 'Healthcare & Medical Devices',
  'Industrial Automation', 'IoT & Smart Devices', 'Software & SaaS',
  'Telecommunications', 'Other',
];

export default function OrgSetupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [craRole, setCraRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim() && country && companySize && craRole;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/org', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, country, companySize, craRole, industry }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create organisation');
        setSubmitting(false);
        return;
      }

      await refreshUser();
      navigate('/dashboard');
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '600px' }}>
        <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>
          CRANIS<span style={{ color: 'var(--accent)' }}>2</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Set up your organisation to get started with CRA compliance
        </div>

        <form className="auth-card org-setup-form" onSubmit={handleSubmit}>
          {error && (
            <div className="form-error" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {/* Organisation Name */}
          <div className="form-group">
            <label className="form-label">
              <Building2 size={16} style={{ marginRight: '0.5rem', verticalAlign: '-2px' }} />
              Organisation Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Acme Software GmbH"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Country */}
          <div className="form-group">
            <label className="form-label">
              <Globe size={16} style={{ marginRight: '0.5rem', verticalAlign: '-2px' }} />
              Country <span className="required">*</span>
            </label>
            <select
              className="form-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Select country...</option>
              {EU_COUNTRIES.map((c) =>
                c.startsWith('────') ? (
                  <option key={c} disabled>{c}</option>
                ) : (
                  <option key={c} value={c}>{c}</option>
                )
              )}
            </select>
          </div>

          {/* Company Size */}
          <div className="form-group">
            <label className="form-label">
              <Users size={16} style={{ marginRight: '0.5rem', verticalAlign: '-2px' }} />
              Company Size <span className="required">*</span>
            </label>
            <div className="size-grid">
              {COMPANY_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`size-card ${companySize === s.value ? 'selected' : ''}`}
                  onClick={() => setCompanySize(s.value)}
                >
                  <span className="size-label">{s.label}</span>
                  <span className="size-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CRA Role */}
          <div className="form-group">
            <label className="form-label">
              <Shield size={16} style={{ marginRight: '0.5rem', verticalAlign: '-2px' }} />
              CRA Role <span className="required">*</span>
            </label>
            <div className="role-grid">
              {CRA_ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.value}
                    type="button"
                    className={`role-card ${craRole === r.value ? 'selected' : ''}`}
                    onClick={() => setCraRole(r.value)}
                  >
                    <Icon size={24} className="role-icon" />
                    <span className="role-label">{r.label}</span>
                    <span className="role-desc">{r.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Industry (optional) */}
          <div className="form-group">
            <label className="form-label">
              Industry <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span>
            </label>
            <select
              className="form-input"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isValid || submitting}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {submitting ? 'Creating...' : (
              <>Create Organisation <ArrowRight size={18} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
