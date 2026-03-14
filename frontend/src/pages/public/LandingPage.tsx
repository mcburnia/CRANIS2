import { Link } from 'react-router-dom';
import {
  Users, Package, Shield, BarChart3, Bell, Lock,
  ShieldCheck, Globe, Award, Fingerprint,
  CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './LandingPage.css';

/* ── Feature + audience data ── */

const features = [
  { icon: Package, title: 'Automated SBOM & Scanning', desc: "Three-tier dependency detection across 28 lockfile formats and 26 languages. Daily scans against 445,000+ known vulnerabilities. Your software bill of materials, always current." },
  { icon: Shield, title: 'CRA Technical File', desc: "Eight structured sections matching CRA Annex VII. Auto-populated content for product description, vulnerability handling, standards, and test reports. Cuts documentation effort by 60\u201380%." },
  { icon: BarChart3, title: 'Obligation Intelligence', desc: "35 CRA obligations across manufacturer, importer, and distributor roles. Statuses derived automatically from platform data, including SBOMs, scans, technical file progress, field issues, and crypto scans. Always know your true compliance standing." },
  { icon: Lock, title: 'Evidence Vault & Retention', desc: "Cryptographically signed compliance snapshots with RFC 3161 timestamps and 10-year cold storage retention. Tamper-evident evidence that satisfies CRA Art. 13(10)." },
  { icon: Bell, title: 'ENISA Reporting & Alerts', desc: "24-hour, 72-hour, and 14-day deadline tracking for mandatory vulnerability and incident reporting. Escalating alerts so you never miss a regulatory deadline." },
  { icon: Users, title: 'AI Copilot & Integrations', desc: "AI-powered suggestions for technical files, vulnerability triage, risk assessments, and incident reports. Public API, CI/CD gate, Trello integration, and IDE assistant via MCP." },
];

const audiences = [
  { title: 'Solo developers & small teams', desc: 'Affordable CRA compliance without hiring consultants. Auto-populated technical files, AI copilot, and a step-by-step action plan get you to conformity faster.' },
  { title: 'Software product companies', desc: 'End-to-end compliance for every product you sell into the EU. SBOMs, vulnerability monitoring, technical documentation, and regulatory reporting, all automated.' },
  { title: 'B2B software vendors', desc: 'Provide customers with SBOMs, compliance evidence, and escrow coverage. List on the compliance marketplace to demonstrate your posture publicly.' },
  { title: 'Compliance & legal teams', desc: 'Obligation tracking, deadline alerts, conformity assessments, and a 10-year evidence vault with legal holds. Everything auditors expect, without chasing developers.' },
];

/* ── Regulation section data ── */

const regulations = [
  {
    id: 'cra',
    icon: Shield,
    title: 'CRA (Cyber Resilience Act)',
    subtitle: 'EU regulation for secure software products',
    intro: "From late 2027, if you sell or distribute software in the EU, it must meet mandatory cybersecurity standards. That means maintaining an SBOM, monitoring vulnerabilities, retaining technical documentation for 10 years, and reporting incidents to ENISA within strict deadlines.",
    mustDemonstrate: [
      'A Software Bill of Materials (SBOM) for every product with digital elements',
      'Active vulnerability monitoring and timely remediation of known CVEs',
      'A technical file covering risk assessment, design, testing, and standards (Annex VII)',
      'Mandatory incident and vulnerability reporting to ENISA within 24/72 hours',
      'Retention of technical documentation for 10 years after market placement (Art. 13(10))',
    ],
    howSupports: [
      'Automated SBOM generation from your repositories across 28 lockfile formats and 26 languages',
      'Daily scans against 445,000+ vulnerabilities with AI-powered triage and fix commands',
      'CRA Technical File with 8 structured sections and auto-populated content',
      'ENISA reporting workflow with deadline tracking and escalating alerts',
      'Compliance Evidence Vault with RFC 3161 timestamps, digital signing, and 10-year cold storage',
    ],
    related: ['EU Declaration of Conformity', 'CRA Action Plan', 'Conformity assessments'],
  },
  {
    id: 'nis2',
    icon: ShieldCheck,
    title: 'NIS2 (Network and Information Security Directive)',
    subtitle: 'EU rules for cybersecurity resilience',
    intro: "NIS2 requires organisations that provide important services, including software, to demonstrate strong cybersecurity governance. It covers supply-chain risk, incident response, vulnerability handling, and management accountability.",
    mustDemonstrate: [
      'Risk-based security decisions with documented evidence',
      'Supply-chain risk management for third-party dependencies',
      'Incident detection, response, and reporting capabilities',
      'Vulnerability handling procedures and timely remediation',
      'Management accountability for cybersecurity measures',
    ],
    howSupports: [
      'Dependency-level risk visibility across your entire software supply chain',
      'Supplier due diligence questionnaires with automatic registry enrichment',
      'AI-powered risk assessments with Annex I mappings, exportable as Markdown',
      'Licence compliance scanning with copyleft detection and compatibility analysis',
      'Audit trail of every compliance action with timestamps and user attribution',
    ],
    related: ['Supply-chain risk management', 'Incident response', 'Conformity assessments'],
  },
  {
    id: 'gdpr',
    icon: Lock,
    title: 'GDPR (General Data Protection Regulation)',
    subtitle: 'Protecting personal data in the EU',
    intro: "If your software processes personal data, GDPR requires you to control who can access it, minimise unnecessary access, and demonstrate accountability. CRANIS2 helps you build that evidence.",
    mustDemonstrate: [
      'Appropriate technical and organisational security measures',
      'Data protection by design and by default',
      'Accountability and evidence of compliance',
      'Security of processing, including supply chain oversight',
    ],
    howSupports: [
      'Vulnerability monitoring ensures known security weaknesses are identified and remediated',
      'Structured compliance evidence demonstrates accountability to regulators',
      'Supply chain visibility through SBOMs and dependency risk analysis',
      'EU and Swiss hosting. Your compliance evidence stays under European jurisdiction',
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
    intro: "There is growing concern in Europe about where compliance data is stored and who can access it. If your evidence sits on a US-controlled platform, a foreign government could compel access, undermining your compliance position.",
    mustDemonstrate: [
      'You control where your compliance evidence is stored',
      'You understand the risks of foreign authorities accessing your data',
      'Your approach aligns with EU expectations for digital independence',
    ],
    howSupports: [
      'Built and governed in Europe, by a European company',
      'Hosting in the EU and Switzerland. Your data stays under European law',
      'No dependency on US-controlled platforms for your compliance evidence',
      'Your audit trail and compliance artefacts remain under European jurisdiction',
    ],
    related: [],
    callout: {
      type: 'highlight' as const,
      text: "For the CRA and NIS2, where your evidence is stored, and who can access it, is becoming just as important as the evidence itself.",
    },
  },
];

const isoStandards = [
  'ISO 27001 \u2013 Information Security Management',
  'ISO 27002 \u2013 Security Controls',
  'ISO 27005 \u2013 Risk Management',
  'Secure software development best practices',
];

const isoHelps = [
  'Structured technical documentation aligned with CRA Annex VII',
  'Tamper-evident compliance snapshots with cryptographic timestamps',
  'Audit-friendly evidence vault with 10-year retention',
];

const dogfoodingBullets = [
  'We track our own products, SBOMs, and vulnerabilities using CRANIS2',
  'Our CRA technical files and obligation statuses are managed on the platform',
  'Our compliance evidence is stored in the same vault we offer to customers',
  'Improvements come from real regulatory pressure, not theoretical exercises',
];

const dogfoodingWhy = [
  'We face the same CRA compliance challenges as our customers',
  'The product is shaped by our own experience, not just theory',
  'There is no separate internal tool or shortcut for our own team',
  'What we recommend to you is exactly what we rely on ourselves',
];

const isItems = [
  'An end-to-end CRA and NIS2 compliance platform covering SBOMs, vulnerability monitoring, technical documentation, and regulatory reporting',
  'A compliance evidence vault with cryptographic timestamps, digital signatures, and 10-year retention',
  'A European alternative to expensive consultants and heavyweight governance software',
];

const isNotItems = [
  'A legal certification body. We help you gather and retain evidence, not issue certificates',
  'A guarantee of compliance. That responsibility remains with your organisation',
  'A source code analysis tool. We read import statements and dependency files, never your business logic',
];

export default function LandingPage() {
  usePageMeta();
  return (
    <div className="landing">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="nav-logo">CRANIS<span>2</span></div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#compliance">Compliance</a>
          <a href="#pricing">Pricing</a>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/docs">Documentation</Link>
          <Link to="/login">Log In</Link>
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
        <h1>Compliance<br /><span>without the chaos</span></h1>
        <p>Automated SBOMs, vulnerability monitoring, technical documentation, and regulatory reporting for the EU Cyber Resilience Act and NIS2.</p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary btn-lg">Try CRANIS2 Free</Link>
          <a href="#features" className="btn btn-outline btn-lg">See How It Works</a>
        </div>
        <div className="price-badge">Standard <strong>&euro;6</strong>/contributor/month &middot; Pro <strong>&euro;9</strong>/product + &euro;6/contributor</div>
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
        <p>New EU rules are changing what is expected of software companies. Here is what they mean for you, and how CRANIS2 helps.</p>
      </section>

      {/* §0: Dogfooding – FIRST, before regulations */}
      <section id="dogfooding" className="reg-section">
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
            This is not marketing theatre. We run the same platform, under the same rules, with the same scrutiny we ask of our customers.
          </div>
        </div>
      </section>

      {/* §1–§4: Regulation sections */}
      {regulations.map((reg) => (
        <section
          key={reg.id}
          id={reg.id}
          className="reg-section"
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
      <section id="iso" className="reg-section">
        <div className="reg-inner">
          <div className="reg-header">
            <Award size={32} className="reg-icon" />
            <div>
              <h2>International Standards Alignment</h2>
              <p className="reg-subtitle">Supporting, not certifying</p>
            </div>
          </div>
          <p className="reg-intro">
            CRANIS2 does not certify you against any standard, but it helps you build the kind of evidence that auditors and assessors expect to see.
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
        <div className="pricing-tiers">
          <div className="pricing-tier">
            <h3>Standard</h3>
            <div className="pricing-amount">&euro;6 <span>/ contributor / month</span></div>
            <p>SBOMs, vulnerability monitoring, licence compliance, 35-obligation tracking, technical file, ENISA reporting, post-market monitoring, crypto inventory, evidence vault, document templates, and conformity assessments.</p>
          </div>
          <div className="pricing-tier pricing-tier-pro">
            <h3>Pro</h3>
            <div className="pricing-amount">&euro;9 <span>/ product / month</span> + &euro;6 <span>/ contributor</span></div>
            <p>Everything in Standard plus AI copilot, public API, CI/CD compliance gate, Trello integration, IDE assistant via MCP, and GRC/OSCAL bridge.</p>
          </div>
        </div>
        <p style={{ marginTop: '1.5rem', opacity: 0.8 }}>A contributor is anyone with write access to a registered code repository. No hidden fees. One invoice per organisation.</p>
        <div className="cta-buttons">
          <Link to="/signup" className="btn btn-primary btn-lg">Start Your Free Trial</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Log In</Link>
        </div>
        <div className="cta-sub">90-day free trial &middot; No credit card required</div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        CRANIS2 &copy; 2026 &middot; Software Compliance &amp; Governance Platform &middot; EU hosted, customer-owned evidence
      </footer>
    </div>
  );
}
