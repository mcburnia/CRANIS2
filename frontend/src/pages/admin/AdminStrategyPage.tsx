import { useState, useEffect, useRef } from 'react';
import PageHeader from '../../components/PageHeader';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminStrategyPage.css';

const SECTIONS = [
  { id: 'regulations', label: 'Why These Regulations Exist' },
  { id: 'supply-chain', label: 'The Supply Chain Problem' },
  { id: 'compliance-gap', label: 'The Compliance Gap' },
  { id: 'role-of-cranis2', label: 'The Role of CRANIS2' },
  { id: 'dev-platforms', label: 'Development Platforms in Context' },
  { id: 'long-tail', label: 'The Long Tail of Software' },
  { id: 'trust-centre', label: 'The CRANIS2 Trust Centre' },
  { id: 'trust-network', label: 'The Trust Network' },
  { id: 'software-ecosystem', label: 'Within the Software Ecosystem' },
  { id: 'financial-ecosystem', label: 'Within the Financial Ecosystem' },
  { id: 'strategic-positioning', label: 'Strategic Positioning' },
  { id: 'core-message', label: 'The Core Message' },
];

export default function AdminStrategyPage() {
  usePageMeta();
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible section
          const sorted = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(sorted[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    const sections = document.querySelectorAll('.ast-section');
    sections.forEach(s => observerRef.current?.observe(s));

    return () => observerRef.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }

  return (
    <div className="admin-strategy">
      <PageHeader title="Strategy & Ecosystem" />
      <p className="ast-subtitle">
        Internal reference for the CRANIS2 team. This page explains the regulatory drivers, market opportunity,
        ecosystem positioning, and strategic direction of the platform.
      </p>

      <div className="ast-layout">
        <nav className="ast-nav">
          <div className="ast-nav-inner">
            <span className="ast-nav-title">Contents</span>
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                className={`ast-nav-link ${activeId === s.id ? 'active' : ''}`}
                onClick={() => scrollTo(s.id)}
              >
                <span className="ast-nav-num">{i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="ast-content">

          {/* ── 1. Why These Regulations Exist ──────────────────────────────── */}
          <section id="regulations" className="ast-section">
            <h2>1. Why These Regulations Exist</h2>
            <p>
              Europe introduced two major cybersecurity regulations that are fundamentally changing the software industry:
            </p>
            <ul>
              <li><strong>The Cyber Resilience Act (CRA)</strong> – entered into force December 2024. Any product containing digital elements sold in the EU must meet cybersecurity requirements, carry a CE mark, and maintain ongoing compliance.</li>
              <li><strong>The NIS2 Directive</strong> – already being transposed into national law. Organisations operating critical infrastructure must demonstrate security baselines.</li>
            </ul>
            <p>
              These regulations exist because software supply chains have become a major security risk.
              Modern software products often contain hundreds or thousands of third-party components, many of which
              are poorly maintained or not well understood by the companies using them.
            </p>
            <p>
              Governments recognised that organisations frequently do not know what software components they are using,
              and therefore cannot effectively manage security risks.
            </p>
            <p>The regulations aim to ensure that companies placing digital products on the EU market:</p>
            <ul>
              <li>Understand their software composition</li>
              <li>Monitor vulnerabilities</li>
              <li>Maintain security processes</li>
              <li>Provide compliance evidence</li>
            </ul>
            <p>The regulations are designed to protect citizens, businesses, and critical infrastructure.</p>

            <div className="ast-timeline">
              <div className="ast-timeline-item">
                <span className="ast-timeline-date">Dec 2024</span>
                <span className="ast-timeline-desc">CRA enters into force</span>
              </div>
              <div className="ast-timeline-item">
                <span className="ast-timeline-date">Sep 2026</span>
                <span className="ast-timeline-desc">CRA reporting obligations begin. Companies must report actively exploited vulnerabilities within 24 hours</span>
              </div>
              <div className="ast-timeline-item">
                <span className="ast-timeline-date">Dec 2027</span>
                <span className="ast-timeline-desc">Full CRA compliance required. Products without CE mark cannot be sold in the EU</span>
              </div>
            </div>

            <div className="ast-callout ast-callout-warn">
              Penalties for non-compliance: up to EUR 15 million or 2.5% of global annual turnover (CRA);
              up to EUR 10 million or 2% of global annual turnover (NIS2).
            </div>
          </section>

          {/* ── 2. The Software Supply Chain Problem ────────────────────────── */}
          <section id="supply-chain" className="ast-section">
            <h2>2. The Software Supply Chain Problem</h2>
            <p>
              Most software today is assembled rather than written from scratch.
              Applications commonly depend on frameworks, libraries, sub-libraries, open-source components,
              and external services. This creates a complex supply chain where vulnerabilities can propagate rapidly.
            </p>
            <p>
              Major incidents such as Log4j demonstrated that many organisations cannot even answer
              simple questions like:
            </p>
            <div className="ast-callout">
              "Are we using this vulnerable component anywhere in our systems?"
            </div>
            <p>
              This lack of visibility is the problem regulators are trying to solve.
              When a critical vulnerability is disclosed, companies need to know within hours, not days or weeks,
              whether they are affected. Without a structured inventory of software components, this is impossible.
            </p>
            <p>
              The supply chain problem is compounded by transitive dependencies: dependencies of dependencies.
              A typical web application may declare 20 direct dependencies but actually include 200 or more
              transitive packages. Each one is a potential vector for vulnerability, licence conflict, or
              supply chain attack.
            </p>
          </section>

          {/* ── 3. The Compliance Gap ───────────────────────────────────────── */}
          <section id="compliance-gap" className="ast-section">
            <h2>3. The Compliance Gap</h2>
            <p>
              Most software companies, especially smaller ones, do not currently maintain:
            </p>
            <ul>
              <li>Software bills of materials (SBOMs)</li>
              <li>Dependency inventories</li>
              <li>Vulnerability monitoring processes</li>
              <li>Licence compliance tracking</li>
              <li>Regulatory documentation (technical files, declarations of conformity)</li>
            </ul>
            <p>Without automation, this work requires:</p>
            <ul>
              <li>Expensive consultants (typically EUR 500–1,500/day)</li>
              <li>Manual audits that become stale immediately</li>
              <li>Complex spreadsheets that no one maintains</li>
            </ul>
            <p>
              Small engineering teams simply cannot manage this effectively alongside product development.
              The compliance burden is real but the tooling has not existed to make it manageable.
              This is the gap that CRANIS2 fills.
            </p>
          </section>

          {/* ── 4. The Role of CRANIS2 ─────────────────────────────────────── */}
          <section id="role-of-cranis2" className="ast-section">
            <h2>4. The Role of CRANIS2</h2>
            <p>
              CRANIS2 exists to automate the mechanical work required to manage software supply chain governance.
            </p>
            <p>It provides:</p>
            <ul>
              <li><strong>Dependency discovery</strong> – three-tier detection across 28 lockfile formats and 26 languages</li>
              <li><strong>SBOM generation</strong> – in CycloneDX 1.6 and SPDX 2.3 formats</li>
              <li><strong>Vulnerability monitoring</strong> – local database of 445,000+ known vulnerabilities updated daily, scanned in sub-second time</li>
              <li><strong>Licence tracking</strong> – SPDX classification, copyleft detection, cross-licence incompatibility analysis</li>
              <li><strong>Technical documentation</strong> – CRA Annex VII technical file with auto-population from platform data</li>
              <li><strong>EU Declaration of Conformity</strong> – professionally formatted PDF generation</li>
              <li><strong>Regulatory reporting</strong> – ENISA Article 14 reporting with deadline tracking</li>
              <li><strong>Intellectual property proof</strong> – RFC 3161 cryptographic timestamps</li>
              <li><strong>Source code escrow</strong> – self-hosted Forgejo deposits with European data sovereignty</li>
            </ul>
            <p>
              Rather than creating a compliance department inside a small company, CRANIS2 allows compliance
              to become an automated system that runs alongside development.
            </p>
            <div className="ast-callout">
              The platform turns engineering activity that is already happening, such as writing code, managing dependencies,
              and running builds, into structured compliance evidence.
            </div>
          </section>

          {/* ── 5. Development Platforms in Context ─────────────────────────── */}
          <section id="dev-platforms" className="ast-section">
            <h2>5. Development Platforms in Context</h2>
            <p>
              Many developers assume that GitHub and its associated tools solve the software supply chain problem.
            </p>
            <p>
              GitHub is an extremely powerful development platform and works very well for source code management,
              collaboration, CI/CD, and dependency alerts. However, GitHub and tools like Dependabot were not
              designed to manage regulatory compliance or full software governance.
            </p>
            <p>
              Dependabot focuses on specific package ecosystems and dependency manifests.
              It provides alerts and automated pull requests for outdated or vulnerable packages.
              This is valuable but represents only one part of what compliance requires.
            </p>
            <p>
              What development platforms do not provide:
            </p>
            <ul>
              <li>Structured SBOMs in regulatory formats (CycloneDX, SPDX)</li>
              <li>CRA technical file documentation</li>
              <li>EU Declaration of Conformity generation</li>
              <li>ENISA incident reporting workflows</li>
              <li>Licence compliance analysis with cross-licence incompatibility detection</li>
              <li>Cryptographic IP proof (RFC 3161)</li>
              <li>Obligation tracking against specific CRA articles</li>
              <li>Source code escrow with defined release models</li>
            </ul>
            <p>
              CRANIS2 therefore complements development platforms by adding a governance and compliance layer
              on top of existing engineering workflows. It connects to GitHub, Codeberg, Gitea, Forgejo, and GitLab,
              including self-hosted instances, and converts the development activity already happening into
              compliance evidence.
            </p>
            <div className="ast-callout">
              CRANIS2 does not compete with development platforms. It sits on top of them and provides
              the compliance visibility they were not designed to deliver.
            </div>
          </section>

          {/* ── 6. The Long Tail of Software Ecosystems ────────────────────── */}
          <section id="long-tail" className="ast-section">
            <h2>6. The Long Tail of Software Ecosystems</h2>
            <p>
              A large portion of global software development happens outside the most popular modern package ecosystems.
              These environments are common in sectors that are most affected by CRA and NIS2 requirements.
            </p>
            <p>Examples include environments built around:</p>
            <div className="ast-columns">
              <ul>
                <li>C and C++</li>
                <li>Pascal and Delphi</li>
                <li>Ada</li>
                <li>Fortran</li>
                <li>COBOL</li>
              </ul>
              <ul>
                <li>Embedded systems</li>
                <li>Industrial control systems</li>
                <li>Medical device firmware</li>
                <li>Energy infrastructure</li>
                <li>Telecommunications</li>
              </ul>
            </div>
            <p>
              These environments often use custom dependency mechanisms and build systems that mainstream
              dependency scanners do not support.
            </p>
            <p>
              CRANIS2 currently supports modern ecosystems: 26 languages via import scanning
              and 28 lockfile formats, including C and C++ header detection. The legacy and embedded
              environments listed above represent significant expansion opportunities as the CRA compliance
              deadline approaches and these sectors begin looking for tooling.
            </p>
            <div className="ast-callout">
              The sectors with the most complex dependency challenges, such as healthcare, energy, transport, and
              industrial automation, are also the sectors most directly regulated by NIS2. This alignment
              between market need and regulatory pressure represents an important strategic opportunity.
            </div>
          </section>

          {/* ── 7. The CRANIS2 Trust Centre ──────────────────────────────────── */}
          <section id="trust-centre" className="ast-section">
            <h2>7. The CRANIS2 Trust Centre</h2>
            <p>
              CRANIS2 already includes a Trust Centre capability. This is strategically important and must be
              clearly understood by the team.
            </p>
            <p>
              The Trust Centre allows organisations to publish software products that meet compliance expectations.
              Other organisations can discover and evaluate these products. Compliance badges displayed on
              Trust Centre listings are computed from real platform data, including vulnerability scan results,
              obligation completion, and licence scan coverage, and cannot be self-declared.
            </p>
            <p>The Trust Centre connects:</p>
            <ul>
              <li><strong>Software vendors</strong> – who want to demonstrate that their products are compliant and trustworthy</li>
              <li><strong>Enterprises and NIS2 organisations</strong> – who need to evaluate the security posture of their suppliers</li>
              <li><strong>Investors</strong> – who want visibility into software governance before committing capital</li>
              <li><strong>Insurers</strong> – who need to assess cyber risk exposure</li>
              <li><strong>Regulators</strong> – who may reference compliance evidence during market surveillance</li>
            </ul>
            <p>
              This creates a trusted discovery environment for software suppliers: a place where compliance
              is demonstrable rather than declarative.
            </p>
            <p>
              Trust Centre listings require platform admin approval before becoming visible. This curation
              step ensures quality and prevents misuse.
            </p>
          </section>

          {/* ── 8. The Trust Network ────────────────────────────────────────── */}
          <section id="trust-network" className="ast-section">
            <h2>8. The Trust Network</h2>
            <p>
              As more vendors register products and maintain compliance evidence inside CRANIS2, the platform
              becomes a trusted supply chain network. Each registered product contributes to a growing ecosystem
              of verified software.
            </p>
            <p>Over time the platform can evolve into a trusted directory for:</p>
            <ul>
              <li>Compliant software products with verified evidence</li>
              <li>Verified supply chains with dependency transparency</li>
              <li>Secure software vendors with auditable governance</li>
            </ul>
            <p>
              This creates strong network effects. More vendors attract more buyers and evaluators,
              which attracts more vendors. The compliance evidence generated on the platform, such as SBOMs,
              vulnerability scan histories, and obligation completion records, accumulates over time and
              becomes increasingly valuable.
            </p>
            <div className="ast-callout">
              The trust network effect is the long-term strategic differentiator. Individual compliance tools
              can be replicated. A network of verified vendors with accumulated compliance histories
              is significantly harder to replicate.
            </div>
          </section>

          {/* ── 9. CRANIS2 Within the Software Ecosystem ───────────────────── */}
          <section id="software-ecosystem" className="ast-section">
            <h2>9. CRANIS2 Within the Software Ecosystem</h2>
            <p>CRANIS2 sits on top of the existing development ecosystem.</p>
            <div className="ast-layer-diagram">
              <div className="ast-layer ast-layer-top">
                <strong>CRANIS2</strong>
                <span>Compliance evidence, governance visibility, regulatory documentation</span>
              </div>
              <div className="ast-layer ast-layer-mid">
                <strong>Security Scanners & Dependency Tools</strong>
                <span>Vulnerability alerts, dependency updates, code scanning</span>
              </div>
              <div className="ast-layer ast-layer-base">
                <strong>Development Platforms</strong>
                <span>GitHub, GitLab, Codeberg, Gitea, Forgejo – source code, CI/CD, collaboration</span>
              </div>
            </div>
            <p>
              Developers build software using their existing tools and workflows. Security scanners
              and dependency tools provide alerts about vulnerabilities and outdated packages.
            </p>
            <p>
              CRANIS2 then converts the engineering activity and dependency data into:
            </p>
            <ul>
              <li>Compliance evidence (SBOMs, licence analyses, vulnerability reports)</li>
              <li>Governance visibility (obligation tracking, stakeholder management)</li>
              <li>Regulatory documentation (technical files, declarations of conformity, ENISA reports)</li>
            </ul>
            <p>
              This allows organisations to demonstrate that their products are safe and compliant
              without changing how they build software. The compliance layer is additive, not disruptive.
            </p>
          </section>

          {/* ── 10. CRANIS2 Within the Financial Ecosystem ─────────────────── */}
          <section id="financial-ecosystem" className="ast-section">
            <h2>10. CRANIS2 Within the Financial Ecosystem</h2>
            <p>
              CRANIS2 produces evidence that is useful well beyond technical compliance.
              The structured information generated by the platform can support several financial
              and commercial processes:
            </p>

            <div className="ast-use-cases">
              <div className="ast-use-case">
                <h3>Professional Indemnity Insurance</h3>
                <p>
                  Insurers assessing cyber risk exposure can use security posture evidence,
                  including vulnerability scan histories, obligation completion, and dependency governance, to
                  make more informed underwriting decisions. Companies with demonstrable governance
                  may qualify for lower premiums.
                </p>
              </div>
              <div className="ast-use-case">
                <h3>R&D Tax Credit Claims</h3>
                <p>
                  Development activity records, including repository sync histories, dependency analyses,
                  and technical documentation, can support tax relief documentation by demonstrating
                  systematic R&D activity and technological advancement.
                </p>
              </div>
              <div className="ast-use-case">
                <h3>Business Loan Credibility</h3>
                <p>
                  Banks can better evaluate software companies when their digital assets and governance
                  processes are visible. A structured compliance programme signals operational maturity
                  that lenders find reassuring.
                </p>
              </div>
              <div className="ast-use-case">
                <h3>Investor Due Diligence</h3>
                <p>
                  Investors can review security posture, software governance, dependency health,
                  and compliance readiness as part of their evaluation process. The due diligence export
                  provides this in a single downloadable package.
                </p>
              </div>
              <div className="ast-use-case">
                <h3>Company Acquisition Processes</h3>
                <p>
                  Acquirers can audit software supply chains, intellectual property provenance (via RFC 3161
                  timestamps), licence compliance, and vulnerability exposure. This reduces acquisition risk
                  and can accelerate deal timelines.
                </p>
              </div>
            </div>

            <div className="ast-callout">
              CRANIS2 becomes part of the broader financial ecosystem surrounding software companies.
              It is not just a compliance checkbox, but a source of structured evidence that multiple
              stakeholders can use for decision-making.
            </div>
          </section>

          {/* ── 11. Strategic Positioning ───────────────────────────────────── */}
          <section id="strategic-positioning" className="ast-section">
            <h2>11. Strategic Positioning</h2>
            <p>
              CRANIS2 is not just a compliance tool. It can become a form of digital infrastructure
              for software governance and trust.
            </p>
            <p>The platform connects:</p>
            <ul>
              <li><strong>Software developers</strong> – who need to demonstrate compliance without disrupting workflows</li>
              <li><strong>Regulators</strong> – who need evidence that products meet CRA and NIS2 requirements</li>
              <li><strong>Enterprises</strong> – who need to evaluate their software supply chain security</li>
              <li><strong>Insurers</strong> – who need to quantify cyber risk</li>
              <li><strong>Investors</strong> – who need governance visibility before committing capital</li>
              <li><strong>Financial institutions</strong> – who need to evaluate software companies as creditworthy businesses</li>
            </ul>
            <p>
              Its role is to transform software engineering activity into verifiable trust signals.
              Every SBOM generated, every vulnerability scan completed, every obligation met: these are
              data points that contribute to a picture of trustworthiness that multiple stakeholders
              can rely on.
            </p>
          </section>

          {/* ── 12. The Core Message ────────────────────────────────────────── */}
          <section id="core-message" className="ast-section">
            <h2>12. The Core Message</h2>
            <div className="ast-callout ast-callout-primary">
              <p className="ast-core-statement">
                CRANIS2 helps organisations prove that their software can be trusted.
              </p>
              <p>
                It does this by turning development activity, dependency data, and security monitoring
                into structured compliance evidence.
              </p>
              <p>
                Over time the platform can evolve into a trusted ecosystem for software supply chains
                within the European digital market.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
