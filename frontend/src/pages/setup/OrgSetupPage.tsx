
export default function OrgSetupPage() {
  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '540px' }}>
        <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>
          CRANIS<span style={{ color: 'var(--accent)' }}>2</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Step 2 of 7 — Select your organisation
        </div>
        <div className="auth-card">
          <p style={{ color: 'var(--muted)', textAlign: 'center' }}>
            Organisation setup will be implemented here.
          </p>
        </div>
      </div>
    </div>
  );
}
