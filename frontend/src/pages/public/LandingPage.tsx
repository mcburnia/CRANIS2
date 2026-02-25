import { Link } from 'react-router-dom';
import {
  Users, Package, Shield, BarChart3, Bell, Lock,
  ShieldCheck, Globe, Award, Fingerprint,
  CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react';
import './LandingPage.css';

/* ── Feature + audience data ── */

const features = [
  { icon: Users, title: 'Contributor Tracking', desc: "See exactly who has access to your code repositories, every day. Dormant accounts are flagged automatically so nothing slips through the cracks." },
  { icon: Package, title: 'Automated Risk Scanning', desc: "Every code change triggers a check of your software dependencies against known vulnerability databases — daily, with zero manual effort." },
  { icon: Shield, title: 'Obligation Management', desc: "Understand what the regulations require of your products, track your progress, and build your compliance file — step by step." },
  { icon: BarChart3, title: 'Outsourcing Governance', desc: "Independent evidence of who's actually working on your code — not just what the supplier invoice says." },
  { icon: Bell, title: 'Smart Notifications', desc: "Finance sees billing. Compliance sees obligations. Tech leads see access changes. Everyone gets exactly what they need, nothing more." },
  { icon: Lock, title: 'Immutable Audit Trail', desc: "Every snapshot, every change, every action — preserved as your evidence trail, ready for when auditors come knocking." },
];

const audiences = [
  { title: 'Solo developers & small teams', desc: 'Affordable compliance for independent software makers who need to meet EU requirements without a big budget.' },
  { title: 'Software agencies', desc: 'Auditable evidence of good practice that you can share with clients who ask tough questions about security.' },
  { title: 'Enterprise development teams', desc: 'Access governance and compliance reporting across internal teams and external contractors, all in one place.' },
  { title: 'Compliance & legal teams', desc: 'Obligation tracking, deadline alerts, and compliance file completeness visible at a glance — no chasing developers.' },
];

/* ── Regulation section data ── */

const regulations = [
  {
    id: 'cra',
    icon: Shield,
    title: 'CRA (Cyber Resilience Act)',
    subtitle: 'EU regulation for secure software products',
    intro: "From late 2027, if you sell or distribute software in the EU, it must meet mandatory cybersecurity standards. That means proving your software is built securely, vulnerabilities are handled properly, and you know exactly who contributed to the code.",
    mustDemonstrate: [
      'Your software is designed and built with security in mind from the start',
      'You actively monitor and fix vulnerabilities in your code and its dependencies',
      'You report serious security incidents and exploited vulnerabilities promptly',
      'You manage the risks from third-party code and libraries in your supply chain',
      'You can show who had access to the code and when changes were made',
    ],
    howSupports: [
      'Shows you exactly who has access to and modifies your code, across all projects',
      'Tracks every change across your repositories with a clear paper trail',
      'Automatically builds evidence of how you handle vulnerability decisions',
      'Provides time-boxed workflows that match the reporting deadlines',
      'Makes your software supply chain visible, including outsourced work',
    ],
    related: ['Secure development evidence', 'Supply-chain accountability', 'Audit-ready decision logs'],
  },
  {
    id: 'nis2',
    icon: ShieldCheck,
    title: 'NIS2 (Network and Information Security Directive)',
    subtitle: 'EU rules for cybersecurity resilience',
    intro: "NIS2 requires organisations that provide important services — including software — to demonstrate strong cybersecurity governance. It's particularly focused on access control, supply-chain risk, and being ready to respond to incidents.",
    mustDemonstrate: [
      'Security decisions are made based on actual risk, not guesswork',
      'You control and review who has access to your systems',
      'You understand the cybersecurity risks from your suppliers and partners',
      'You can detect, respond to, and report security incidents',
      'Your leadership team is accountable for cybersecurity',
    ],
    howSupports: [
      'Gives you ongoing visibility of everyone with access — not just the active ones',
      'Encourages good habits like off-boarding people who no longer need access',
      'Maps the connection between your contributors, your products, and your risk exposure',
      'Provides evidence that access is regularly reviewed and managed over time',
      'Produces lightweight audit evidence that works for small and medium businesses',
    ],
    related: ['Access control governance', 'Supply-chain risk management', 'Incident preparedness evidence'],
  },
  {
    id: 'gdpr',
    icon: Lock,
    title: 'GDPR (General Data Protection Regulation)',
    subtitle: 'Protecting personal data in the EU',
    intro: "If your software processes personal data, GDPR requires you to control who can access it, minimise unnecessary access, and demonstrate accountability. CRANIS2 helps you build that evidence.",
    mustDemonstrate: [
      'Only the right people have access to systems that handle personal data',
      'You can show who has access and why',
      'You have appropriate security measures in place',
      'Privacy is considered from the design stage, not bolted on afterwards',
    ],
    howSupports: [
      'Shows clearly who has access to repositories and systems that may handle personal data',
      'Provides evidence that you actively manage and review access permissions',
      'Helps reduce unnecessary or forgotten access — supporting the principle of data minimisation',
      'EU and Swiss hosting options to keep your compliance evidence in the right jurisdiction',
    ],
    related: [],
    callout: {
      type: 'note' as const,
      text: "To be clear: CRANIS2 doesn't replace a full data protection programme, but it provides strong supporting evidence for the access control and accountability parts of GDPR.",
    },
  },
  {
    id: 'sovereignty',
    icon: Globe,
    title: 'European Digital Sovereignty',
    subtitle: 'Keeping control of your compliance evidence',
    intro: "There's a growing concern in Europe about where compliance data is stored and who can access it. If your evidence sits on a US-controlled platform, a foreign government could potentially compel access to it — undermining your compliance position.",
    mustDemonstrate: [
      'You control where your compliance evidence is stored',
      'You understand the risks of foreign authorities accessing your data',
      'Your approach aligns with EU expectations for digital independence',
    ],
    howSupports: [
      'Built and governed in Europe, by a European company',
      'Hosting in the EU and Switzerland — your data stays under European law',
      'No dependency on US-controlled platforms for your compliance evidence',
      'Your audit trail and compliance artefacts remain under European jurisdiction',
    ],
    related: [],
    callout: {
      type: 'highlight' as const,
      text: "For the CRA and NIS2, where your evidence is stored — and who can access it — is becoming just as important as the evidence itself.",
    },
  },
];

const isoStandards = [
  'ISO 27001 — Information Security Management',
  'ISO 27002 — Security Controls',
  'ISO 27005 — Risk Management',
  'Secure software development best practices',
];

const isoHelps = [
  'Traceable records of who accessed and changed your code',
  'Audit-friendly evidence you can hand to assessors',
  'Clear governance over your software supply chain',
];

const dogfoodingBullets = [
  'We monitor our own repositories and contributors using CRANIS2',
  'The same access governance rules apply to our team and our contractors',
  'Our compliance workflows are tested in real conditions, not simulations',
  'Improvements come from real regulatory pressure, not theoretical exercises',
];

const dogfoodingWhy = [
  'We face the same compliance challenges as our customers',
  'The product is shaped by lived experience, not just theory',
  'There is no separate internal tool or shortcut for our own team',
  'What we recommend to you is exactly what we rely on ourselves',
];

const isItems = [
  'A platform that helps you understand and evidence your compliance obligations',
  'A tool for tracking who has access to your code and what risks exist',
  'A European alternative to expensive, heavyweight governance software',
];

const isNotItems = [
  'A legal certification — we help you gather evidence, not issue certificates',
  'A guarantee of compliance — that responsibility remains with your organisation',
  'A replacement for good security practices — we help you prove you have them',
];

export default function LandingPage() {
  return (
    <div className="landing">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="nav-logo">CRANIS<span>2</span></div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#compliance">Compliance</a>
          <a href="#pricing">Pricing</a>
          <Link to="/marketplace" className="nav-marketplace-link">Marketplace</Link>
          <Link to="/signup" className="btn btn-primary">Try CRANIS2 Free</Link>
        </div>
        <button className="mobile-menu-btn" onClick={() => {
          document.querySelector('.nav-links')?.classList.toggle('open');
        }}>
          <span /><span /><span />
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <h1>Software compliance<br /><span>without the chaos</span></h1>
        <p>Know who's building your software, what's in it, and whether it meets EU requirements. Affordable at any scale.</p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary btn-lg">Try CRANIS2 Free</Link>
          <a href="#features" className="btn btn-outline btn-lg">See How It Works</a>
        </div>
        <div className="price-badge">From <strong>&euro;6</strong> / contributor / month</div>
      </section>

      {/* ── Features ── */}
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

      {/* ── Audience ── */}
      <section id="who" className="audience">
        <h2>Built for software teams of every size</h2>
        <div className="audience-grid">
          {audiences.map((a) => (
            <div className="audience-card" key={a.title}>
              <h4>{a.title}</h4>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* Compliance sections                       */}
      {/* ══════════════════════════════════════════ */}

      <section id="compliance" className="compliance-intro">
        <h2>Regulation by regulation</h2>
        <p>New EU rules are changing what's expected of software companies. Here's what they mean for you — and how CRANIS2 helps.</p>
      </section>

      {/* §0: Dogfooding — FIRST, before regulations */}
      <section id="dogfooding" className="reg-section reg-alt">
        <div className="reg-inner">
          <div className="reg-header">
            <Fingerprint size={32} className="reg-icon" />
            <div>
              <h2>We Use CRANIS2 Ourselves</h2>
              <p className="reg-subtitle">Credibility through practice, not just promises</p>
            </div>
          </div>
          <p className="reg-intro">
            <strong>Our principle is simple:</strong> we use CRANIS2 to manage and evidence our own compliance. If it's not good enough for us, it's not good enough for you.
          </p>
          <div className="reg-columns">
            <div className="reg-col">
              <h3>What this means in practice</h3>
              <ul className="reg-list">
                {dogfoodingBullets.map((s, i) => (
                  <li key={i}><ChevronRight size={14} className="reg-bullet" />{s}</li>
                ))}
              </ul>
            </div>
            <div className="reg-col">
              <h3>Why that matters to you</h3>
              <ul className="reg-list reg-list-accent">
                {dogfoodingWhy.map((s, i) => (
                  <li key={i}><CheckCircle2 size={14} className="reg-check" />{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="reg-callout reg-callout-highlight">
            This isn't marketing theatre. It's dogfooding at regulatory depth — the same tool, the same rules, the same scrutiny.
          </div>
        </div>
      </section>

      {/* §1–§4: Regulation sections */}
      {regulations.map((reg, i) => (
        <section
          key={reg.id}
          id={reg.id}
          className={`reg-section ${i % 2 !== 0 ? 'reg-alt' : ''}`}
        >
          <div className="reg-inner">
            <div className="reg-header">
              <reg.icon size={32} className="reg-icon" />
              <div>
                <h2>{reg.title}</h2>
                <p className="reg-subtitle">{reg.subtitle}</p>
              </div>
            </div>
            <p className="reg-intro">{reg.intro}</p>

            <div className="reg-columns">
              <div className="reg-col">
                <h3>What you need to show</h3>
                <ul className="reg-list">
                  {reg.mustDemonstrate.map((item, j) => (
                    <li key={j}><ChevronRight size={14} className="reg-bullet" />{item}</li>
                  ))}
                </ul>
              </div>
              <div className="reg-col">
                <h3>How CRANIS2 helps</h3>
                <ul className="reg-list reg-list-accent">
                  {reg.howSupports.map((item, j) => (
                    <li key={j}><CheckCircle2 size={14} className="reg-check" />{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {reg.related.length > 0 && (
              <div className="reg-tags">
                <span className="reg-tags-label">Also supports:</span>
                {reg.related.map((tag) => (
                  <span className="reg-tag" key={tag}>{tag}</span>
                ))}
              </div>
            )}

            {reg.callout && (
              <div className={`reg-callout reg-callout-${reg.callout.type}`}>
                {reg.callout.text}
              </div>
            )}
          </div>
        </section>
      ))}

      {/* §5: ISO / Good Practice */}
      <section id="iso" className="reg-section reg-alt">
        <div className="reg-inner">
          <div className="reg-header">
            <Award size={32} className="reg-icon" />
            <div>
              <h2>International Standards Alignment</h2>
              <p className="reg-subtitle">Supporting — not certifying</p>
            </div>
          </div>
          <p className="reg-intro">
            CRANIS2 doesn't certify you against any standard, but it helps you build the kind of evidence that auditors and assessors expect to see, including for:
          </p>
          <div className="reg-columns">
            <div className="reg-col">
              <h3>Standards we align with</h3>
              <ul className="reg-list">
                {isoStandards.map((s, i) => (
                  <li key={i}><ChevronRight size={14} className="reg-bullet" />{s}</li>
                ))}
              </ul>
            </div>
            <div className="reg-col">
              <h3>How CRANIS2 helps</h3>
              <ul className="reg-list reg-list-accent">
                {isoHelps.map((s, i) => (
                  <li key={i}><CheckCircle2 size={14} className="reg-check" />{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* §7: What CRANIS2 Is / Is Not */}
      <section id="clarity" className="reg-section">
        <div className="reg-inner">
          <div className="reg-header">
            <Shield size={32} className="reg-icon" />
            <div>
              <h2>Honest About What We Are</h2>
              <p className="reg-subtitle">And equally honest about what we're not</p>
            </div>
          </div>
          <div className="is-isnot-grid">
            <div className="is-col is-yes">
              <h3>CRANIS2 is</h3>
              <ul>
                {isItems.map((item, i) => (
                  <li key={i}><CheckCircle2 size={16} className="is-check" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="is-col is-no">
              <h3>CRANIS2 is not</h3>
              <ul>
                {isNotItems.map((item, i) => (
                  <li key={i}><XCircle size={16} className="is-x" />{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="is-tagline">This honesty protects you as much as it protects us.</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="pricing" className="cta-section">
        <h2>Simple, transparent pricing</h2>
        <p>&euro;6 per contributor per month. A contributor is anyone with write access to a registered code repository. No hidden fees. No per-project charges. One invoice per organisation.</p>
        <div className="cta-buttons">
          <Link to="/signup" className="btn btn-primary btn-lg">Start Your Free Trial</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Log In</Link>
        </div>
        <div className="cta-sub">90-day free trial &middot; No credit card required</div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        CRANIS2 &copy; 2026 — Software Compliance &amp; Governance Platform — EU hosted, customer-owned evidence
      </footer>
    </div>
  );
}
