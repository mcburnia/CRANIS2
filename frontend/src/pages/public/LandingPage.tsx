import { Link } from 'react-router-dom';
import { Users, Package, Shield, BarChart3, Bell, Lock } from 'lucide-react';
import './LandingPage.css';

const features = [
  { icon: Users, title: 'Contributor Tracking', desc: "Know exactly who has write access to every CRA-relevant repo, every day. Dormant accounts are surfaced automatically." },
  { icon: Package, title: 'Automated SBOM & Risk Scanning', desc: "Every code change triggers dependency analysis. Libraries are checked against vulnerability databases daily — no manual effort." },
  { icon: Shield, title: 'CRA Obligation Management', desc: "Classify your products, generate obligations automatically, and track progress toward Annex V technical file completion." },
  { icon: BarChart3, title: 'Outsourcing Governance', desc: "Independent evidence of who's actually working on your code — not just what the supplier invoice says." },
  { icon: Bell, title: 'Role-Based Notifications', desc: "Finance sees billing. Compliance sees obligations. Tech leads see access changes. Everyone gets exactly what they need." },
  { icon: Lock, title: 'Immutable Audit Trail', desc: "Every snapshot, every change, every action — preserved immutably as your evidence for CRA audit discussions." },
];

const audiences = [
  { title: 'Indie developers & micro-ISVs', desc: 'Affordable compliance for solo and small teams shipping CRA-relevant products.' },
  { title: 'Software agencies', desc: 'Auditable evidence of good practice to satisfy regulated clients.' },
  { title: 'Enterprise development orgs', desc: 'Access governance and compliance reporting across internal teams and outsourced suppliers.' },
  { title: 'Compliance officers', desc: 'Obligation tracking, deadline alerts, and technical file completeness at a glance.' },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="nav-logo">CRANIS<span>2</span></div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#who">Who It's For</a>
          <a href="#pricing">Pricing</a>
          <Link to="/signup" className="btn btn-primary">Get Started</Link>
        </div>
        <button className="mobile-menu-btn" onClick={() => {
          document.querySelector('.nav-links')?.classList.toggle('open');
        }}>
          <span /><span /><span />
        </button>
      </nav>

      <section className="hero">
        <h1>CRA compliance<br /><span>without the chaos</span></h1>
        <p>Continuous, defensible evidence of who's building your software and what's in it. GitHub-integrated. Affordable at any scale.</p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary btn-lg">Get Started Free</Link>
          <a href="#features" className="btn btn-outline btn-lg">See How It Works</a>
        </div>
        <div className="price-badge">From <strong>€6</strong> / contributor / month</div>
      </section>

      <section id="features" className="features">
        {features.map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon-wrapper">
              <f.icon size={28} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <section id="who" className="audience">
        <h2>Built for software organisations of every size</h2>
        <div className="audience-grid">
          {audiences.map((a) => (
            <div className="audience-card" key={a.title}>
              <h4>{a.title}</h4>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="cta-section">
        <h2>Simple, transparent pricing</h2>
        <p>€6.00 per contributor per month. A contributor is anyone with write access to a registered repo. No hidden fees. No per-repo charges. One invoice per organisation.</p>
        <Link to="/signup" className="btn btn-primary btn-lg">Start Your Free Trial</Link>
      </section>

      <footer className="landing-footer">
        CRANIS2 © 2026 — CRA Compliance & Governance Platform — EU hosted, customer-owned evidence
      </footer>
    </div>
  );
}
