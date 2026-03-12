/**
 * NIS2 Readiness Assessment — data, scoring, and page generation
 *
 * Follows the same pattern as the CRA assessment but covers the
 * EU Network and Information Security Directive 2 (Directive 2022/2555).
 */

/* ── Sections ──────────────────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'applicability',
    title: 'Applicability & Classification',
    description: 'NIS2 applies to organisations in specific sectors that meet size thresholds. These questions help determine whether your organisation falls within scope and whether it would be classified as an essential or important entity — which affects the supervision regime and penalty levels.',
  },
  {
    id: 'governance',
    title: 'Governance & Accountability',
    description: 'Article 20 of NIS2 places direct responsibility on management bodies for approving cybersecurity risk-management measures and overseeing their implementation. Management must receive cybersecurity training, and failure to comply can result in personal liability for directors.',
  },
  {
    id: 'risk_management',
    title: 'Risk Management Measures',
    description: 'Article 21 requires entities to take appropriate and proportionate technical, operational, and organisational measures to manage cybersecurity risks. These measures must be based on an all-hazards approach and protect network and information systems and their physical environment.',
  },
  {
    id: 'incident_reporting',
    title: 'Incident Reporting',
    description: 'Article 23 establishes strict incident reporting timelines: an early warning within 24 hours, an incident notification within 72 hours, and a final report within one month. Entities must have the internal processes and tooling to detect, classify, and report significant incidents within these windows.',
  },
  {
    id: 'supply_chain',
    title: 'Supply Chain Security',
    description: 'Article 21(2)(d) requires entities to address supply chain security, including security-related aspects of relationships with direct suppliers and service providers. This involves assessing supplier risks, setting contractual security requirements, and monitoring compliance across the supply chain.',
  },
  {
    id: 'business_continuity',
    title: 'Business Continuity',
    description: 'Article 21(2)(c) requires business continuity and crisis management capabilities, including backup management, disaster recovery, and crisis management procedures. Entities must be able to maintain or rapidly restore operations following a cybersecurity incident.',
  },
  {
    id: 'technical_measures',
    title: 'Technical Security Measures',
    description: 'Article 21(2) mandates a range of technical measures including encryption, multi-factor authentication, access control, vulnerability handling, and network security. These form the technical foundation that supports all other NIS2 compliance activities.',
  },
];

/* ── Questions ─────────────────────────────────────────────────────────── */

const QUESTIONS = [
  // ── Section 0: Applicability & Classification ──
  {
    id: 'sector',
    section: 0,
    question: 'Which sector does your organisation primarily operate in?',
    explanation: 'NIS2 applies to organisations in sectors listed in Annexes I (highly critical) and II (other critical). Annex I sectors include energy, transport, banking, financial market infrastructure, health, drinking water, waste water, digital infrastructure, ICT service management, public administration, and space. Annex II covers postal services, waste management, chemicals, food, manufacturing, digital providers, and research.',
    nis2_reference: 'Annexes I & II',
    options: [
      { label: 'Not listed — our sector is not in Annex I or II', score: 0 },
      { label: 'Annex II sector — other critical sector (e.g. postal, food, manufacturing, digital providers)', score: 1 },
      { label: 'Annex I sector — highly critical (e.g. energy, transport, health, digital infrastructure)', score: 2 },
      { label: 'Multiple Annex I sectors — we operate across several highly critical sectors', score: 3 },
    ],
  },
  {
    id: 'entity_size',
    section: 0,
    question: 'What is the size of your organisation?',
    explanation: 'NIS2 generally applies to medium-sized and large enterprises. Medium enterprises have 50–249 employees or €10M–€50M turnover. Large enterprises have 250+ employees or €50M+ turnover. Some entities are in scope regardless of size — including providers of DNS services, TLD name registries, cloud computing, data centres, CDNs, managed services/security services, trust services, and public electronic communications networks.',
    nis2_reference: 'Article 2; Recitals 7–9',
    options: [
      { label: 'Micro/small — fewer than 50 employees and under €10M turnover', score: 0 },
      { label: 'Medium — 50–249 employees or €10M–€50M turnover', score: 1 },
      { label: 'Large — 250+ employees or €50M+ turnover', score: 2 },
      { label: 'Size-independent — we provide DNS, TLD, cloud, data centre, CDN, managed security, or trust services', score: 3 },
    ],
  },
  {
    id: 'cross_border',
    section: 0,
    question: 'Does your organisation provide services or operate infrastructure across EU member states?',
    explanation: 'Entities operating across borders may be subject to NIS2 requirements in multiple jurisdictions. Article 26 provides for jurisdiction based on the main establishment, but entities providing cross-border services may need to engage with multiple national authorities. DNS service providers, TLD registries, cloud providers, and others fall under the jurisdiction where their main establishment is located.',
    nis2_reference: 'Articles 26–27',
    options: [
      { label: 'Single country — we only operate in one EU member state', score: 0 },
      { label: 'Limited cross-border — services in 2–3 member states', score: 1 },
      { label: 'Significant cross-border — services across multiple member states', score: 2 },
      { label: 'Pan-European — critical services or infrastructure spanning most/all EU member states', score: 3 },
    ],
  },

  // ── Section 1: Governance & Accountability ──
  {
    id: 'board_oversight',
    section: 1,
    question: 'Does your management body actively oversee cybersecurity risk management?',
    explanation: 'Article 20(1) requires management bodies to approve cybersecurity risk-management measures and to oversee their implementation. This is not a delegable responsibility — the board or equivalent body must be directly involved. Non-compliance can lead to temporary prohibitions on exercising managerial functions (Article 32(5)(b)).',
    nis2_reference: 'Article 20(1); Article 32(5)',
    options: [
      { label: 'Not started — cybersecurity is handled by IT without board involvement', score: 0 },
      { label: 'Aware — the board receives occasional updates but does not formally approve measures', score: 1 },
      { label: 'Partial — the board reviews cybersecurity periodically but hasn\'t formally approved risk measures', score: 2 },
      { label: 'Implemented — the board formally approves risk-management measures and reviews them regularly', score: 3 },
    ],
  },
  {
    id: 'mgmt_training',
    section: 1,
    question: 'Do members of your management body receive cybersecurity training?',
    explanation: 'Article 20(2) requires members of management bodies to follow training to gain sufficient knowledge and skills to identify risks and assess cybersecurity risk-management practices. NIS2 also encourages entities to offer similar training to their employees on a regular basis. This training must be ongoing, not a one-off exercise.',
    nis2_reference: 'Article 20(2)',
    options: [
      { label: 'Not started — no cybersecurity training for management', score: 0 },
      { label: 'Aware — management knows training is needed but none has been delivered', score: 1 },
      { label: 'Partial — some managers have received training but it\'s not systematic or regular', score: 2 },
      { label: 'Implemented — all management body members complete regular cybersecurity training with documented records', score: 3 },
    ],
  },
  {
    id: 'cyber_policies',
    section: 1,
    question: 'Do you have formal cybersecurity policies approved by management?',
    explanation: 'Article 21(2)(a) requires entities to have policies on risk analysis and information system security. These policies must be formally approved by the management body (Article 20) and should cover the full scope of NIS2 requirements — from incident handling and business continuity to supply chain security and vulnerability management. They must be reviewed and updated regularly.',
    nis2_reference: 'Article 21(2)(a); Article 20',
    options: [
      { label: 'Not started — no formal cybersecurity policies exist', score: 0 },
      { label: 'Aware — informal guidelines exist but nothing formally documented or approved', score: 1 },
      { label: 'Partial — some policies exist but they don\'t cover all NIS2 areas or aren\'t management-approved', score: 2 },
      { label: 'Implemented — comprehensive, management-approved policies covering all Article 21 areas, regularly reviewed', score: 3 },
    ],
  },

  // ── Section 2: Risk Management Measures ──
  {
    id: 'risk_assessment',
    section: 2,
    question: 'Do you conduct regular cybersecurity risk assessments?',
    explanation: 'Article 21(1) requires measures to be "appropriate and proportionate" to the risks, taking into account the state of the art, relevant standards, cost of implementation, and the entity\'s size, exposure, and likelihood/severity of incidents. This requires a structured risk assessment process that identifies threats, evaluates their probability and impact, and informs the selection of security measures.',
    nis2_reference: 'Article 21(1); Article 21(2)(a)',
    options: [
      { label: 'Not started — no formal risk assessment process', score: 0 },
      { label: 'Aware — we understand risks informally but have no documented process', score: 1 },
      { label: 'Partial — we conduct risk assessments but not regularly or comprehensively', score: 2 },
      { label: 'Implemented — regular, documented risk assessments covering all network and information systems, reviewed annually', score: 3 },
    ],
  },
  {
    id: 'incident_handling',
    section: 2,
    question: 'Do you have established incident handling procedures?',
    explanation: 'Article 21(2)(b) specifically requires "incident handling" as one of the minimum cybersecurity risk-management measures. This means having defined processes for detecting, analysing, containing, responding to, and recovering from cybersecurity incidents. The procedures should define roles, escalation paths, communication protocols, and post-incident review processes.',
    nis2_reference: 'Article 21(2)(b)',
    options: [
      { label: 'Not started — no defined incident handling procedures', score: 0 },
      { label: 'Aware — we respond to incidents ad hoc without a formal process', score: 1 },
      { label: 'Partial — basic incident response exists but roles, escalation, and review processes aren\'t formalised', score: 2 },
      { label: 'Implemented — comprehensive incident handling with defined roles, escalation, containment, and post-incident review', score: 3 },
    ],
  },
  {
    id: 'hr_security',
    section: 2,
    question: 'Do you address human resources security and cybersecurity awareness?',
    explanation: 'Article 21(2)(i) requires "human resources security, access control policies and asset management." This includes security screening for critical roles, security awareness training for all staff, clear acceptable use policies, and procedures for joiners, movers, and leavers. People are often the weakest link — NIS2 recognises this explicitly.',
    nis2_reference: 'Article 21(2)(i); Article 20(2)',
    options: [
      { label: 'Not started — no cybersecurity awareness programme or HR security measures', score: 0 },
      { label: 'Aware — basic onboarding mentions security but there\'s no ongoing programme', score: 1 },
      { label: 'Partial — awareness training exists but isn\'t regular, or HR security processes have gaps', score: 2 },
      { label: 'Implemented — regular awareness training, security screening, defined joiner/mover/leaver processes, asset management', score: 3 },
    ],
  },

  // ── Section 3: Incident Reporting ──
  {
    id: 'early_warning',
    section: 3,
    question: 'Can you issue an early warning to your national CSIRT within 24 hours of detecting a significant incident?',
    explanation: 'Article 23(4)(a) requires an early warning within 24 hours of becoming aware of a significant incident. The early warning must indicate whether the incident is suspected to be caused by unlawful or malicious acts and whether it could have a cross-border impact. This is the tightest deadline and requires 24/7 detection capability and clear escalation to the person authorised to notify.',
    nis2_reference: 'Article 23(4)(a)',
    options: [
      { label: 'Not started — no process for rapid incident detection or notification', score: 0 },
      { label: 'Aware — we know about the 24-hour requirement but can\'t reliably meet it', score: 1 },
      { label: 'Partial — we have detection tools but the escalation-to-notification path isn\'t tested', score: 2 },
      { label: 'Implemented — 24/7 detection, defined escalation, tested notification process meeting the 24-hour deadline', score: 3 },
    ],
  },
  {
    id: 'incident_notification',
    section: 3,
    question: 'Can you submit a full incident notification within 72 hours?',
    explanation: 'Article 23(4)(b) requires an incident notification within 72 hours of becoming aware of the significant incident. This must update the early warning and provide an initial assessment of the incident, including its severity and impact, and indicators of compromise where available. This requires the ability to rapidly analyse an incident and produce a structured report.',
    nis2_reference: 'Article 23(4)(b)',
    options: [
      { label: 'Not started — no structured incident analysis or reporting capability', score: 0 },
      { label: 'Aware — we can investigate incidents but producing a report within 72 hours is uncertain', score: 1 },
      { label: 'Partial — we have incident analysis processes but haven\'t tested producing NIS2-compliant reports within 72 hours', score: 2 },
      { label: 'Implemented — tested process for incident analysis and NIS2-compliant notification within 72 hours, with templates ready', score: 3 },
    ],
  },
  {
    id: 'final_report',
    section: 3,
    question: 'Can you produce a detailed final report within one month of the incident notification?',
    explanation: 'Article 23(4)(d) requires a final report within one month containing a detailed description of the incident (severity, impact), the type of threat or root cause, applied and ongoing mitigation measures, and the cross-border impact if applicable. This requires thorough post-incident analysis, root cause investigation, and documentation of lessons learned.',
    nis2_reference: 'Article 23(4)(d)',
    options: [
      { label: 'Not started — we don\'t produce post-incident reports', score: 0 },
      { label: 'Aware — we do informal post-mortems but nothing meeting NIS2 requirements', score: 1 },
      { label: 'Partial — we produce incident reports but they don\'t cover all NIS2 required elements', score: 2 },
      { label: 'Implemented — structured post-incident process producing NIS2-compliant final reports with root cause analysis', score: 3 },
    ],
  },

  // ── Section 4: Supply Chain Security ──
  {
    id: 'supplier_assessment',
    section: 4,
    question: 'Do you assess the cybersecurity posture of your direct suppliers and service providers?',
    explanation: 'Article 21(2)(d) requires entities to address "supply chain security, including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers." Article 21(3) specifies that entities must take into account the vulnerabilities specific to each supplier, the overall quality of products and cybersecurity practices, and the results of coordinated security risk assessments.',
    nis2_reference: 'Article 21(2)(d); Article 21(3)',
    options: [
      { label: 'Not started — we don\'t assess suppliers\' cybersecurity', score: 0 },
      { label: 'Aware — we know supplier risk is important but have no assessment process', score: 1 },
      { label: 'Partial — we assess some critical suppliers but coverage is incomplete', score: 2 },
      { label: 'Implemented — systematic supplier risk assessment covering all direct suppliers and service providers', score: 3 },
    ],
  },
  {
    id: 'supplier_contracts',
    section: 4,
    question: 'Do your contracts with suppliers include cybersecurity requirements?',
    explanation: 'NIS2 expects entities to use contractual arrangements to manage supply chain risk. This means including cybersecurity requirements in contracts — covering areas like vulnerability disclosure, incident notification, access controls, audit rights, and compliance with relevant standards. Contracts should also address what happens when a supplier\'s cybersecurity posture changes or a breach occurs.',
    nis2_reference: 'Article 21(2)(d); Recital 85',
    options: [
      { label: 'Not started — contracts don\'t include cybersecurity clauses', score: 0 },
      { label: 'Aware — some contracts mention security but without specific NIS2-aligned requirements', score: 1 },
      { label: 'Partial — critical supplier contracts include security requirements but it\'s not standard practice', score: 2 },
      { label: 'Implemented — standard cybersecurity clauses in all supplier contracts covering incident notification, audit rights, and compliance', score: 3 },
    ],
  },
  {
    id: 'supplier_monitoring',
    section: 4,
    question: 'Do you monitor the ongoing cybersecurity practices of your supply chain?',
    explanation: 'Supply chain security is not a one-time assessment. Entities must continuously monitor suppliers\' security posture, respond to newly discovered vulnerabilities in supplier products, and react to security incidents at suppliers that could affect their own services. This includes tracking supplier CVE disclosures, security advisories, and conducting periodic reviews.',
    nis2_reference: 'Article 21(2)(d); Article 21(3)',
    options: [
      { label: 'Not started — no ongoing monitoring of supplier cybersecurity', score: 0 },
      { label: 'Aware — we react to major supplier incidents but don\'t proactively monitor', score: 1 },
      { label: 'Partial — we track major suppliers\' security advisories but lack systematic monitoring', score: 2 },
      { label: 'Implemented — continuous monitoring of supplier security posture with alerting and periodic reviews', score: 3 },
    ],
  },

  // ── Section 5: Business Continuity ──
  {
    id: 'backup_management',
    section: 5,
    question: 'Do you have comprehensive backup management procedures?',
    explanation: 'Article 21(2)(c) specifically lists "backup management" as a required measure. Backups must be regular, tested, stored securely (including off-site or isolated), and able to support restoration within acceptable timeframes. The rise of ransomware makes backup integrity and isolation particularly critical — backups that are accessible from compromised systems provide no protection.',
    nis2_reference: 'Article 21(2)(c)',
    options: [
      { label: 'Not started — ad hoc or no structured backup procedures', score: 0 },
      { label: 'Aware — backups exist but aren\'t tested regularly or stored securely', score: 1 },
      { label: 'Partial — regular backups with some testing, but no isolated/immutable copies', score: 2 },
      { label: 'Implemented — regular, tested backups with isolated/immutable copies and documented restoration procedures', score: 3 },
    ],
  },
  {
    id: 'disaster_recovery',
    section: 5,
    question: 'Do you have a tested disaster recovery plan?',
    explanation: 'Article 21(2)(c) requires "disaster recovery" capabilities alongside backup management and business continuity. A disaster recovery plan defines how you restore critical systems and services after a major incident. It must include recovery time objectives (RTOs), recovery point objectives (RPOs), priority ordering for system restoration, and must be tested regularly through exercises.',
    nis2_reference: 'Article 21(2)(c)',
    options: [
      { label: 'Not started — no formal disaster recovery plan', score: 0 },
      { label: 'Aware — we have informal ideas about recovery but nothing documented or tested', score: 1 },
      { label: 'Partial — documented DR plan exists but hasn\'t been tested recently', score: 2 },
      { label: 'Implemented — documented DR plan with defined RTOs/RPOs, tested at least annually through tabletop or full exercises', score: 3 },
    ],
  },
  {
    id: 'crisis_management',
    section: 5,
    question: 'Do you have crisis management procedures for cybersecurity events?',
    explanation: 'Article 21(2)(c) includes "crisis management" alongside business continuity. Crisis management goes beyond technical recovery — it covers decision-making under pressure, internal and external communications, coordination with authorities, customer notification, and managing reputational impact. Having a crisis management team, communication templates, and regular exercises is essential.',
    nis2_reference: 'Article 21(2)(c); Article 23',
    options: [
      { label: 'Not started — no crisis management procedures for cybersecurity events', score: 0 },
      { label: 'Aware — we\'d improvise in a crisis but have no formal procedures', score: 1 },
      { label: 'Partial — basic crisis procedures exist but no defined team, communication plan, or exercises', score: 2 },
      { label: 'Implemented — crisis management team, communication plan, authority contact details, and regular exercises', score: 3 },
    ],
  },

  // ── Section 6: Technical Security Measures ──
  {
    id: 'encryption',
    section: 6,
    question: 'Do you use encryption and cryptography to protect data?',
    explanation: 'Article 21(2)(h) requires "policies and procedures regarding the use of cryptography and, where appropriate, encryption." This means having a documented approach to when and how encryption is used — covering data at rest, data in transit, key management, and cryptographic algorithm selection. The policy should reflect the sensitivity of the data being protected and current best practices.',
    nis2_reference: 'Article 21(2)(h)',
    options: [
      { label: 'Not started — limited or no encryption in use', score: 0 },
      { label: 'Aware — TLS for web traffic but no comprehensive encryption strategy', score: 1 },
      { label: 'Partial — encryption in transit and some at rest, but no formal cryptography policy', score: 2 },
      { label: 'Implemented — documented cryptography policy, encryption at rest and in transit, key management procedures', score: 3 },
    ],
  },
  {
    id: 'mfa_access',
    section: 6,
    question: 'Do you implement multi-factor authentication and secure access controls?',
    explanation: 'Article 21(2)(j) requires "the use of multi-factor authentication or continuous authentication solutions, secured voice, video and text communications and secured emergency communication systems." MFA should be mandatory for administrative access, remote access, and access to sensitive systems. This is one of the most effective measures against credential-based attacks.',
    nis2_reference: 'Article 21(2)(j)',
    options: [
      { label: 'Not started — passwords only, no MFA', score: 0 },
      { label: 'Aware — MFA available but not enforced for all critical access', score: 1 },
      { label: 'Partial — MFA enforced for some systems (e.g. email) but not all critical/admin access', score: 2 },
      { label: 'Implemented — MFA mandatory for all administrative and remote access, with conditional access policies', score: 3 },
    ],
  },
  {
    id: 'vuln_handling',
    section: 6,
    question: 'Do you have a process for vulnerability handling and disclosure?',
    explanation: 'Article 21(2)(e) requires "vulnerability handling and disclosure." This means having processes to discover, assess, prioritise, and remediate vulnerabilities in your systems — and to disclose vulnerabilities in a coordinated manner. This includes both scanning your own infrastructure and monitoring for advisories affecting software and hardware you use.',
    nis2_reference: 'Article 21(2)(e)',
    options: [
      { label: 'Not started — no structured vulnerability management', score: 0 },
      { label: 'Aware — occasional scanning but no regular process or prioritisation', score: 1 },
      { label: 'Partial — regular scanning with some remediation process, but no disclosure policy', score: 2 },
      { label: 'Implemented — continuous scanning, risk-based prioritisation, defined remediation SLAs, and coordinated disclosure policy', score: 3 },
    ],
  },
  {
    id: 'network_security',
    section: 6,
    question: 'Is your network architecture designed with security segmentation and monitoring?',
    explanation: 'Article 21(2)(a) references "information system security" and Article 21(2)(e) covers "basic cyber hygiene practices." Network security — including segmentation, firewalling, intrusion detection, and monitoring — is fundamental. Segmentation limits lateral movement after a breach, while monitoring provides visibility needed for incident detection and response.',
    nis2_reference: 'Article 21(2)(a)(e)',
    options: [
      { label: 'Not started — flat network, minimal security controls', score: 0 },
      { label: 'Aware — basic firewalling but no segmentation or monitoring', score: 1 },
      { label: 'Partial — some segmentation and perimeter security, but limited internal monitoring', score: 2 },
      { label: 'Implemented — segmented network, defence in depth, IDS/IPS, SIEM or log monitoring, regular reviews', score: 3 },
    ],
  },
];

/* ── Entity Classification ─────────────────────────────────────────────── */

const ENTITY_LABELS = {
  not_in_scope: 'Likely Not in Scope',
  important: 'Important Entity',
  essential: 'Essential Entity',
  essential_critical: 'Essential Entity (Highly Critical)',
};

function determineEntityClass(answers) {
  const sectorScore = answers.sector !== undefined ? QUESTIONS[0].options[answers.sector].score : 0;
  const sizeScore = answers.entity_size !== undefined ? QUESTIONS[1].options[answers.entity_size].score : 0;

  // Size-independent entities (score 3) are always essential
  if (sizeScore === 3) return 'essential_critical';

  // Not in a listed sector → likely not in scope
  if (sectorScore === 0) return 'not_in_scope';

  // Large entities in Annex I sectors → essential
  if (sizeScore >= 2 && sectorScore >= 2) return 'essential';

  // Medium entities in Annex I, or large in Annex II → important
  if (sizeScore >= 1 && sectorScore >= 1) return 'important';

  // Small entities in listed sectors — generally not in scope but may be
  return 'not_in_scope';
}

function getEntityDetails(entityClass) {
  switch (entityClass) {
    case 'essential_critical':
      return {
        supervision: 'Proactive supervision',
        penalties: 'Up to €10,000,000 or 2% of global annual turnover (whichever is higher)',
        description: 'As a provider of critical digital infrastructure services, your organisation is classified as an essential entity regardless of size. You will be subject to proactive supervision by the competent authority, meaning they may conduct audits and inspections at any time, not only after an incident.',
        regime: 'Essential entities are subject to the most intensive supervisory regime (Article 32).',
      };
    case 'essential':
      return {
        supervision: 'Proactive supervision',
        penalties: 'Up to €10,000,000 or 2% of global annual turnover (whichever is higher)',
        description: 'As a large entity in a highly critical sector, your organisation is classified as essential. You will be subject to proactive supervision — the competent authority may conduct audits, security scans, and on-site inspections at any time.',
        regime: 'Essential entities are subject to the most intensive supervisory regime (Article 32).',
      };
    case 'important':
      return {
        supervision: 'Reactive supervision (ex-post)',
        penalties: 'Up to €7,000,000 or 1.4% of global annual turnover (whichever is higher)',
        description: 'Your organisation is classified as an important entity. You are subject to the same cybersecurity obligations as essential entities, but the supervision regime is less intensive — authorities will typically investigate only after an incident or when given evidence of non-compliance.',
        regime: 'Important entities are subject to reactive supervision (Article 33).',
      };
    default:
      return {
        supervision: 'Not directly supervised under NIS2',
        penalties: 'N/A — not in scope',
        description: 'Based on your responses, your organisation appears unlikely to fall directly within NIS2 scope. However, you may still be affected indirectly — if your customers are in-scope entities, they may impose NIS2-aligned cybersecurity requirements on you through supply chain provisions. Adopting NIS2 measures voluntarily is considered good practice.',
        regime: 'Consider voluntary adoption of NIS2 measures, especially if you serve in-scope customers.',
      };
  }
}

/* ── Scoring ───────────────────────────────────────────────────────────── */

function computeScores(answers) {
  const sectionScores = {};
  const sectionMaxes = {};
  let totalScore = 0;
  let totalMax = 0;

  SECTIONS.forEach(section => {
    sectionScores[section.id] = 0;
    sectionMaxes[section.id] = 0;
  });

  QUESTIONS.forEach(q => {
    const section = SECTIONS[q.section];
    const answer = answers[q.id];
    const score = (answer !== undefined && answer !== null) ? q.options[answer].score : 0;
    const max = 3;
    sectionScores[section.id] += score;
    sectionMaxes[section.id] += max;
    totalScore += score;
    totalMax += max;
  });

  const sectionResults = {};
  SECTIONS.forEach(section => {
    const score = sectionScores[section.id];
    const max = sectionMaxes[section.id];
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    let level;
    if (pct >= 75) level = 'Advanced';
    else if (pct >= 50) level = 'Developing';
    else if (pct >= 25) level = 'Early stage';
    else level = 'Not started';
    sectionResults[section.id] = { score, max, pct, level };
  });

  const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  return { sections: sectionResults, overallPct, totalScore, totalMax };
}

function getTopRecommendations(scores, answers) {
  const recommendations = [];

  const scoredSections = SECTIONS.filter(s => s.id !== 'applicability')
    .map(s => ({ ...s, ...scores.sections[s.id] }))
    .sort((a, b) => a.pct - b.pct);

  scoredSections.forEach(section => {
    if (section.pct >= 75) return;
    const sectionQuestions = QUESTIONS.filter(q => SECTIONS[q.section].id === section.id);
    const weakest = sectionQuestions
      .filter(q => {
        const a = answers[q.id];
        return a === undefined || a === null || q.options[a].score < 2;
      })
      .slice(0, 2);

    weakest.forEach(q => {
      const currentAnswer = answers[q.id];
      const currentScore = (currentAnswer !== undefined && currentAnswer !== null) ? q.options[currentAnswer].score : 0;
      const nextLevel = q.options[Math.min(currentScore + 1, 3)];
      recommendations.push({
        section: section.title,
        question: q.question,
        current: currentScore === 0 ? 'Not started' : q.options[currentAnswer].label,
        target: nextLevel.label,
        nis2_reference: q.nis2_reference,
        priority: currentScore === 0 ? 'high' : 'medium',
      });
    });
  });

  return recommendations.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  }).slice(0, 6);
}

/* ── Report Email ──────────────────────────────────────────────────────── */

function buildReportEmail(answers, scores, entityClass, entityDetails, recommendations, escapeHtml, getUnsubscribeUrl) {
  const entityLabel = ENTITY_LABELS[entityClass] || 'Not Determined';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const sectionBars = SECTIONS.map(s => {
    const sc = scores.sections[s.id];
    const barColor = sc.pct >= 75 ? '#10b981' : sc.pct >= 50 ? '#f59e0b' : sc.pct >= 25 ? '#f97316' : '#ef4444';
    return `<tr>
      <td style="padding:6px 12px 6px 0;font-size:13px;color:#374151;white-space:nowrap;">${s.title}</td>
      <td style="padding:6px 0;width:100%;">
        <div style="background:#f3f4f6;border-radius:4px;height:20px;position:relative;">
          <div style="background:${barColor};border-radius:4px;height:20px;width:${sc.pct}%;min-width:${sc.pct > 0 ? '2px' : '0'};"></div>
        </div>
      </td>
      <td style="padding:6px 0 6px 12px;font-size:13px;color:#111827;font-weight:600;white-space:nowrap;">${sc.pct}%</td>
      <td style="padding:6px 0 6px 8px;font-size:11px;color:#6b7280;white-space:nowrap;">${sc.level}</td>
    </tr>`;
  }).join('\n');

  const questionDetails = SECTIONS.map(section => {
    const sectionQs = QUESTIONS.filter(q => SECTIONS[q.section].id === section.id);
    const rows = sectionQs.map(q => {
      const ansIdx = answers[q.id];
      const answered = ansIdx !== undefined && ansIdx !== null;
      const score = answered ? q.options[ansIdx].score : 0;
      const label = answered ? q.options[ansIdx].label : 'Not answered';
      const dots = [0,1,2,3].map(i =>
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${i <= score - 1 ? '#2563eb' : '#e5e7eb'};"></span>`
      ).join('');
      return `<tr>
        <td style="padding:6px 8px 6px 0;font-size:12px;color:#374151;vertical-align:top;">${q.question}</td>
        <td style="padding:6px 0;font-size:12px;color:#6b7280;vertical-align:top;white-space:nowrap;">${dots}</td>
      </tr>
      <tr><td colspan="2" style="padding:0 0 10px 0;font-size:11px;color:#9ca3af;">${label}</td></tr>`;
    }).join('\n');
    return `<tr><td colspan="2" style="padding:16px 0 6px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${section.title}</td></tr>\n${rows}`;
  }).join('\n');

  const recRows = recommendations.map(r => {
    const priorityColor = r.priority === 'high' ? '#ef4444' : '#f59e0b';
    const priorityLabel = r.priority === 'high' ? 'HIGH' : 'MEDIUM';
    return `<tr>
      <td style="padding:8px 8px 8px 0;vertical-align:top;">
        <span style="font-size:10px;font-weight:700;color:${priorityColor};text-transform:uppercase;">${priorityLabel}</span>
      </td>
      <td style="padding:8px 0;font-size:13px;color:#374151;vertical-align:top;">
        <strong>${r.question}</strong><br>
        <span style="font-size:12px;color:#6b7280;">Next step: ${r.target}</span><br>
        <span style="font-size:11px;color:#a855f7;">${r.nis2_reference}</span>
      </td>
    </tr>`;
  }).join('\n');

  const overallColor = scores.overallPct >= 75 ? '#10b981' : scores.overallPct >= 50 ? '#f59e0b' : scores.overallPct >= 25 ? '#f97316' : '#ef4444';

  // Supervision colour
  const isInScope = entityClass !== 'not_in_scope';
  const isEssential = entityClass === 'essential' || entityClass === 'essential_critical';
  const supervisionColor = isEssential ? '#f59e0b' : isInScope ? '#3b82f6' : '#10b981';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">

<!-- Header -->
<div style="text-align:center;margin-bottom:32px;">
  <div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;">CRANIS2</div>
  <h1 style="font-size:24px;color:#111827;margin:8px 0 4px;">NIS2 Readiness Assessment Report</h1>
  <p style="font-size:13px;color:#6b7280;">${date}</p>
</div>

<!-- Overall Score -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;text-align:center;">
  <div style="font-size:48px;font-weight:700;color:${overallColor};">${scores.overallPct}%</div>
  <div style="font-size:14px;color:#6b7280;margin-bottom:16px;">Overall NIS2 Readiness</div>

  <div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:12px 24px;margin-bottom:16px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Entity Classification</div>
    <div style="font-size:16px;font-weight:700;color:#111827;">${entityLabel}</div>
  </div>

  <div style="margin-top:8px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Supervision Regime</div>
    <div style="font-size:14px;font-weight:600;color:#111827;">${entityDetails.supervision}</div>
    <div style="font-size:12px;color:${supervisionColor};font-weight:600;margin-top:4px;">
      Maximum penalty: ${entityDetails.penalties}
    </div>
  </div>
</div>

<!-- Entity Classification Detail -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 12px;">Your NIS2 Classification</h2>
  <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0 0 8px;">${entityDetails.description}</p>
  <p style="font-size:12px;color:#6b7280;font-style:italic;margin:0;">${entityDetails.regime}</p>
</div>

<!-- Section Breakdown -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Maturity Breakdown</h2>
  <table style="width:100%;border-collapse:collapse;">
    ${sectionBars}
  </table>
</div>

<!-- Detailed Answers -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 8px;">Detailed Responses</h2>
  <table style="width:100%;border-collapse:collapse;">
    ${questionDetails}
  </table>
</div>

<!-- Recommendations -->
${recommendations.length > 0 ? `
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Priority Recommendations</h2>
  <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Based on your responses, these are the areas where action would have the most impact on your NIS2 readiness:</p>
  <table style="width:100%;border-collapse:collapse;">
    ${recRows}
  </table>
</div>
` : ''}

<!-- CTA -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:28px;text-align:center;margin-bottom:20px;">
  <h2 style="font-size:18px;color:#111827;margin:0 0 8px;">CRANIS2 Is Coming Soon</h2>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 16px;">We\u2019re building a platform that helps you manage every aspect of cybersecurity compliance \u2014 from NIS2 governance and risk management to CRA product compliance, vulnerability scanning, and supply chain security.</p>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 16px;"><a href="https://dev.cranis2.dev/welcome" style="color:#a855f7;text-decoration:none;font-weight:600;">Learn more about CRANIS2 \u2192</a></p>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px;">Already assessed your products for CRA? Try our <a href="https://dev.cranis2.dev/cra-conformity-assessment" style="color:#a855f7;text-decoration:none;font-weight:600;">free CRA Readiness Assessment</a> too.</p>
</div>

<!-- Footer -->
<div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:24px;">
  <p>This assessment is for guidance only and does not constitute legal advice. Consult with a qualified professional for specific compliance requirements.</p>
  <p style="margin-top:8px;">\u00a9 CRANIS2 ${new Date().getFullYear()} \u2014 EU Cybersecurity Compliance Platform</p>
</div>

</div>
</body>
</html>`;
}

/* ── Assessment Page HTML ──────────────────────────────────────────────── */

function assessmentPage() {
  const sectionsJson = JSON.stringify(SECTIONS);
  const questionsJson = JSON.stringify(QUESTIONS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NIS2 Readiness Assessment \u2014 CRANIS2</title>
<meta name="description" content="Free NIS2 readiness assessment. Determine your entity classification, supervision regime, and get a personalised maturity report with recommendations for NIS2 compliance.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  h1 { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 28px; line-height: 1.6; }
  .progress-wrap { margin-bottom: 28px; }
  .progress-bar-bg { background: #e5e7eb; border-radius: 4px; height: 6px; }
  .progress-bar { background: #a855f7; border-radius: 4px; height: 6px; transition: width 0.3s; }
  .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-top: 6px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; }
  .email-input { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 12px; }
  .email-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  .code-input { width: 180px; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 18px; font-family: inherit; outline: none; text-align: center; letter-spacing: 4px; }
  .code-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-primary { background: #a855f7; color: white; }
  .btn-primary:hover { background: #9333ea; }
  .btn-primary:disabled { background: #d8b4fe; cursor: not-allowed; }
  .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-sm { padding: 8px 16px; font-size: 13px; }
  .section-header { margin-bottom: 20px; }
  .section-num { font-size: 12px; font-weight: 600; color: #a855f7; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .section-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .section-desc { font-size: 13px; color: #6b7280; line-height: 1.6; }
  .question-block { margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f3f4f6; }
  .question-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .question-text { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px; line-height: 1.4; }
  .question-explain { font-size: 12px; color: #6b7280; line-height: 1.6; margin-bottom: 4px; background: #f9fafb; border-radius: 8px; padding: 12px; }
  .question-ref { font-size: 11px; color: #a855f7; font-weight: 600; margin-bottom: 12px; display: inline-block; }
  .explain-toggle { font-size: 12px; color: #6b7280; cursor: pointer; margin-bottom: 12px; display: inline-block; }
  .explain-toggle:hover { color: #374151; }
  .option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.1s; margin-bottom: 4px; }
  .option:hover { background: #f9fafb; }
  .option.selected { background: #f5f3ff; }
  .option input[type="radio"] { margin-top: 2px; accent-color: #a855f7; width: 16px; height: 16px; flex-shrink: 0; }
  .option label { font-size: 13px; color: #374151; line-height: 1.5; cursor: pointer; }
  .nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .result-score { text-align: center; margin-bottom: 20px; }
  .result-score .big-num { font-size: 56px; font-weight: 700; line-height: 1; }
  .result-score .big-label { font-size: 14px; color: #6b7280; margin-top: 4px; }
  .maturity-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .maturity-label { font-size: 13px; color: #374151; width: 160px; flex-shrink: 0; }
  .maturity-bar-bg { flex: 1; background: #f3f4f6; border-radius: 4px; height: 16px; }
  .maturity-bar { border-radius: 4px; height: 16px; transition: width 0.5s; }
  .maturity-pct { font-size: 13px; font-weight: 600; width: 40px; text-align: right; }
  .maturity-level { font-size: 11px; color: #6b7280; width: 80px; }
  .conformity-box { padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  .conformity-box.ok { background: #ecfdf5; border: 1px solid #a7f3d0; }
  .conformity-box.warning { background: #fffbeb; border: 1px solid #fde68a; }
  .conformity-box.info { background: #eff6ff; border: 1px solid #bfdbfe; }
  .conformity-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .conformity-desc { font-size: 13px; line-height: 1.6; }
  .conformity-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 8px; }
  .conformity-tag.ok { background: #d1fae5; color: #065f46; }
  .conformity-tag.warning { background: #fef3c7; color: #92400e; }
  .conformity-tag.info { background: #dbeafe; color: #1e40af; }
  .rec-item { padding: 12px; border-radius: 8px; background: #f9fafb; margin-bottom: 8px; }
  .rec-priority { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .rec-priority.high { color: #ef4444; }
  .rec-priority.medium { color: #f59e0b; }
  .rec-question { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
  .rec-next { font-size: 12px; color: #6b7280; }
  .rec-ref { font-size: 11px; color: #a855f7; }
  .report-form { display: flex; gap: 8px; align-items: flex-start; }
  .report-form .email-input { margin-bottom: 0; flex: 1; }
  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  .msg-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .msg-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .msg-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }
  .hidden { display: none; }
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .animate-in { animation: fadeIn 0.3s ease-out; }
</style>
</head>
<body>
<div class="page">
  <div class="brand">CRANIS2</div>
  <h1>NIS2 Readiness Assessment</h1>
  <p class="subtitle">
    Find out how ready your organisation is for the EU Network and Information Security Directive 2 (NIS2).
    This free assessment covers 25 questions across 7 key areas, determines your entity classification and
    supervision regime, and provides personalised recommendations.<br>
    <strong>Takes about 12 minutes.</strong> You can save your progress and return later.
  </p>

  <!-- Phase 1: Email verification -->
  <div id="phase-email" class="card">
    <h2 style="font-size:18px;margin-bottom:4px;">Enter your email to begin</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\u2019ll send you a verification code. Your progress is saved automatically so you can return at any time.</p>
    <div id="email-msg"></div>
    <div id="email-step">
      <input type="email" class="email-input" id="email-input" placeholder="you@company.com" autocomplete="email">
      <button class="btn btn-primary" id="send-code-btn" onclick="sendCode()">Send Verification Code</button>
    </div>
    <div id="code-step" class="hidden">
      <p style="font-size:13px;color:#374151;margin-bottom:12px;">Enter the 6-digit code we sent to <strong id="code-email-display"></strong></p>
      <div style="display:flex;gap:12px;align-items:center;">
        <input type="text" class="code-input" id="code-input" maxlength="6" placeholder="000000" autocomplete="one-time-code">
        <button class="btn btn-primary" id="verify-btn" onclick="verifyCode()">Verify</button>
      </div>
      <button class="btn-link" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;margin-top:8px;font-family:inherit;" onclick="resetEmail()">Use a different email</button>
    </div>
  </div>

  <!-- Phase 2: Questionnaire -->
  <div id="phase-questionnaire" class="hidden">
    <div class="progress-wrap">
      <div class="progress-bar-bg"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
      <div class="progress-label">
        <span id="progress-section">Section 1 of 7</span>
        <span id="progress-pct">0%</span>
      </div>
    </div>
    <div class="card" id="question-card"></div>
    <div class="nav-row">
      <button class="btn btn-secondary" id="prev-btn" onclick="prevSection()">Back</button>
      <button class="btn btn-primary" id="next-btn" onclick="nextSection()">Continue</button>
    </div>
  </div>

  <!-- Phase 3: Results -->
  <div id="phase-results" class="hidden animate-in"></div>

  <div class="footer">
    Powered by <a href="https://dev.cranis2.dev/welcome">CRANIS2</a> \u2014 EU Cybersecurity Compliance Platform
    <br><a href="https://dev.cranis2.dev/cra-conformity-assessment">Also try our CRA Readiness Assessment \u2192</a>
  </div>
</div>

<script>
const SECTIONS = ${sectionsJson};
const QUESTIONS = ${questionsJson};
const ENTITY_LABELS = ${JSON.stringify(ENTITY_LABELS)};

let assessmentId = null;
let sessionEmail = '';
let answers = {};
let currentSection = 0;

/* ── Email Verification ── */

async function sendCode() {
  const email = document.getElementById('email-input').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('email-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  const btn = document.getElementById('send-code-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending\u2026';
  showMsg('email-msg', '', '');

  try {
    const res = await fetch('/nis2-conformity-assessment/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg('email-msg', data.error || 'Failed to send code.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Verification Code';
      return;
    }
    sessionEmail = email;
    document.getElementById('code-email-display').textContent = email;
    document.getElementById('email-step').classList.add('hidden');
    document.getElementById('code-step').classList.remove('hidden');
    showMsg('email-msg', 'Verification code sent. Check your inbox.', 'success');
    document.getElementById('code-input').focus();
  } catch (err) {
    showMsg('email-msg', 'Network error. Please try again.', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Send Verification Code';
}

async function verifyCode() {
  const code = document.getElementById('code-input').value.trim();
  if (!code || code.length !== 6) {
    showMsg('email-msg', 'Please enter the 6-digit code.', 'error');
    return;
  }
  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Verifying\u2026';

  try {
    const res = await fetch('/nis2-conformity-assessment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sessionEmail, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg('email-msg', data.error || 'Invalid code.', 'error');
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    assessmentId = data.assessmentId;
    answers = data.answers || {};
    currentSection = data.currentSection || 0;
    if (currentSection >= SECTIONS.length) {
      currentSection = 0;
      answers = {};
    }
    startQuestionnaire();
  } catch (err) {
    showMsg('email-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

function resetEmail() {
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('code-input').value = '';
  showMsg('email-msg', '', '');
  document.getElementById('email-input').focus();
}

/* ── Questionnaire ── */

function startQuestionnaire() {
  document.getElementById('phase-email').classList.add('hidden');
  document.getElementById('phase-questionnaire').classList.remove('hidden');
  renderSection();
}

function renderSection() {
  const section = SECTIONS[currentSection];
  const sectionQs = QUESTIONS.filter(q => q.section === currentSection);

  let html = '<div class="section-header">';
  html += '<div class="section-num">Section ' + (currentSection + 1) + ' of ' + SECTIONS.length + '</div>';
  html += '<div class="section-title">' + section.title + '</div>';
  html += '<div class="section-desc">' + section.description + '</div>';
  html += '</div>';

  sectionQs.forEach((q, qi) => {
    html += '<div class="question-block">';
    html += '<div class="question-text">' + q.question + '</div>';

    const explainId = 'explain-' + q.id;
    html += '<span class="explain-toggle" onclick="toggleExplain(\\'' + explainId + '\\')">Why does this matter? \u25BC</span>';
    html += '<div id="' + explainId + '" class="hidden">';
    html += '<div class="question-explain">' + q.explanation + '</div>';
    html += '<span class="question-ref">' + q.nis2_reference + '</span>';
    html += '</div>';

    q.options.forEach((opt, oi) => {
      const checked = answers[q.id] === oi ? 'checked' : '';
      const selected = answers[q.id] === oi ? 'selected' : '';
      html += '<div class="option ' + selected + '" onclick="selectOption(\\'' + q.id + '\\', ' + oi + ', this)">';
      html += '<input type="radio" name="q_' + q.id + '" value="' + oi + '" ' + checked + ' id="q_' + q.id + '_' + oi + '">';
      html += '<label for="q_' + q.id + '_' + oi + '">' + opt.label + '</label>';
      html += '</div>';
    });

    html += '</div>';
  });

  document.getElementById('question-card').innerHTML = html;

  const pct = Math.round(((currentSection) / SECTIONS.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-section').textContent = 'Section ' + (currentSection + 1) + ' of ' + SECTIONS.length;
  document.getElementById('progress-pct').textContent = pct + '%';

  document.getElementById('prev-btn').style.visibility = currentSection > 0 ? 'visible' : 'hidden';
  const nextBtn = document.getElementById('next-btn');
  if (currentSection === SECTIONS.length - 1) {
    nextBtn.textContent = 'Complete Assessment';
  } else {
    nextBtn.textContent = 'Continue';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleExplain(id) {
  document.getElementById(id).classList.toggle('hidden');
}

function selectOption(qId, optionIndex, el) {
  answers[qId] = optionIndex;
  const parent = el.parentElement;
  parent.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
  saveProgress();
}

async function saveProgress() {
  if (!assessmentId) return;
  try {
    await fetch('/nis2-conformity-assessment/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, answers, currentSection }),
    });
  } catch (err) {
    console.error('Save failed:', err);
  }
}

function prevSection() {
  if (currentSection > 0) {
    currentSection--;
    saveProgress();
    renderSection();
  }
}

async function nextSection() {
  if (currentSection < SECTIONS.length - 1) {
    currentSection++;
    saveProgress();
    renderSection();
  } else {
    await completeAssessment();
  }
}

async function completeAssessment() {
  const btn = document.getElementById('next-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Calculating\u2026';

  try {
    const res = await fetch('/nis2-conformity-assessment/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, answers }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to complete assessment.');
      btn.disabled = false;
      btn.textContent = 'Complete Assessment';
      return;
    }
    showResults(data.scores, data.entityClass);
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Complete Assessment';
  }
}

/* ── Results ── */

function showResults(scores, entityClass) {
  document.getElementById('phase-questionnaire').classList.add('hidden');
  const resultsDiv = document.getElementById('phase-results');
  resultsDiv.classList.remove('hidden');

  const entityLabel = ENTITY_LABELS[entityClass] || 'Not Determined';
  const entityDetails = getEntityDetails(entityClass);
  const recommendations = getTopRecommendations(scores, answers);
  const overallColor = scores.overallPct >= 75 ? '#10b981' : scores.overallPct >= 50 ? '#f59e0b' : scores.overallPct >= 25 ? '#f97316' : '#ef4444';

  let html = '';

  // Overall score
  html += '<div class="card" style="text-align:center;">';
  html += '<div class="result-score"><div class="big-num" style="color:' + overallColor + ';">' + scores.overallPct + '%</div>';
  html += '<div class="big-label">Overall NIS2 Readiness</div></div>';
  html += '<div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:10px 20px;margin-bottom:12px;">';
  html += '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Entity Classification</div>';
  html += '<div style="font-size:16px;font-weight:700;">' + entityLabel + '</div></div>';
  html += '</div>';

  // Entity classification details
  const isEssential = entityClass === 'essential' || entityClass === 'essential_critical';
  const isInScope = entityClass !== 'not_in_scope';
  const confClass = isEssential ? 'warning' : isInScope ? 'info' : 'ok';
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:12px;">Your NIS2 Classification</h2>';
  html += '<div class="conformity-box ' + confClass + '">';
  html += '<div class="conformity-title">' + entityDetails.supervision + '</div>';
  html += '<div class="conformity-desc">' + entityDetails.description + '</div>';
  html += '<span class="conformity-tag ' + confClass + '">Maximum penalty: ' + entityDetails.penalties + '</span>';
  html += '</div>';
  html += '<p style="font-size:12px;color:#6b7280;font-style:italic;margin-top:8px;">' + entityDetails.regime + '</p>';
  html += '</div>';

  // Maturity breakdown
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:16px;">Maturity Breakdown</h2>';
  SECTIONS.forEach(function(s) {
    var sc = scores.sections[s.id];
    var barColor = sc.pct >= 75 ? '#10b981' : sc.pct >= 50 ? '#f59e0b' : sc.pct >= 25 ? '#f97316' : '#ef4444';
    html += '<div class="maturity-row">';
    html += '<div class="maturity-label">' + s.title + '</div>';
    html += '<div class="maturity-bar-bg"><div class="maturity-bar" style="width:' + sc.pct + '%;background:' + barColor + ';"></div></div>';
    html += '<div class="maturity-pct">' + sc.pct + '%</div>';
    html += '<div class="maturity-level">' + sc.level + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Recommendations
  if (recommendations.length > 0) {
    html += '<div class="card">';
    html += '<h2 style="font-size:16px;margin-bottom:8px;">Priority Recommendations</h2>';
    html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Focus on these areas for the biggest improvement in your NIS2 readiness:</p>';
    recommendations.forEach(function(r) {
      html += '<div class="rec-item">';
      html += '<div class="rec-priority ' + r.priority + '">' + r.priority.toUpperCase() + ' PRIORITY</div>';
      html += '<div class="rec-question">' + r.question + '</div>';
      html += '<div class="rec-next">Next step: ' + r.target + '</div>';
      html += '<div class="rec-ref">' + r.nis2_reference + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Send report
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">Get Your Full Report</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\\u2019ll email you a detailed report with your complete assessment, entity classification, maturity scores, and prioritised recommendations. Share it with your team.</p>';
  html += '<div id="report-msg"></div>';
  html += '<div class="report-form" id="report-form">';
  html += '<input type="email" class="email-input" id="report-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="send-report-btn" onclick="sendReport()">Send Report</button>';
  html += '</div>';
  html += '</div>';

  // Coming soon — launch list
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">CRANIS2 Is Coming Soon</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\\u2019re building a platform that helps you manage every aspect of cybersecurity compliance \\u2014 from NIS2 governance and risk management to CRA product compliance, vulnerability scanning, and supply chain security.</p>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Join our launch list and we\\u2019ll let you know when it\\u2019s ready.</p>';
  html += '<div id="subscribe-msg"></div>';
  html += '<div class="report-form" id="subscribe-form">';
  html += '<input type="email" class="email-input" id="subscribe-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="subscribe-btn" onclick="subscribeLaunch()">Notify Me at Launch</button>';
  html += '</div>';
  html += '<p style="font-size:11px;color:#9ca3af;margin-top:12px;line-height:1.5;">We will only use your email to notify you when CRANIS2 launches.<br>No spam, no sharing your information \\u2014 ever.</p>';
  html += '</div>';

  // Start over
  html += '<div style="text-align:center;margin-top:12px;">';
  html += '<button class="btn btn-secondary btn-sm" onclick="startOver()">Start a New Assessment</button>';
  html += '</div>';

  resultsDiv.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getEntityDetails(entityClass) {
  switch (entityClass) {
    case 'essential_critical':
      return { supervision: 'Proactive supervision', penalties: 'Up to \\u20ac10,000,000 or 2% of global annual turnover',
        description: 'As a provider of critical digital infrastructure services, your organisation is classified as an essential entity regardless of size. You will be subject to proactive supervision by the competent authority.',
        regime: 'Essential entities are subject to the most intensive supervisory regime (Article 32).' };
    case 'essential':
      return { supervision: 'Proactive supervision', penalties: 'Up to \\u20ac10,000,000 or 2% of global annual turnover',
        description: 'As a large entity in a highly critical sector, your organisation is classified as essential. You will be subject to proactive supervision \\u2014 the competent authority may conduct audits, security scans, and on-site inspections at any time.',
        regime: 'Essential entities are subject to the most intensive supervisory regime (Article 32).' };
    case 'important':
      return { supervision: 'Reactive supervision (ex-post)', penalties: 'Up to \\u20ac7,000,000 or 1.4% of global annual turnover',
        description: 'Your organisation is classified as an important entity. You are subject to the same cybersecurity obligations as essential entities, but the supervision regime is less intensive.',
        regime: 'Important entities are subject to reactive supervision (Article 33).' };
    default:
      return { supervision: 'Not directly supervised under NIS2', penalties: 'N/A \\u2014 not in scope',
        description: 'Based on your responses, your organisation appears unlikely to fall directly within NIS2 scope. However, you may still be affected indirectly through supply chain requirements.',
        regime: 'Consider voluntary adoption of NIS2 measures, especially if you serve in-scope customers.' };
  }
}

function getTopRecommendations(scores, answers) {
  var recs = [];
  SECTIONS.forEach(function(section, idx) {
    if (section.id === 'applicability') return;
    var sc = scores.sections[section.id];
    if (sc.pct >= 75) return;
    var sectionQs = QUESTIONS.filter(function(q) { return q.section === idx; });
    var weak = sectionQs.filter(function(q) {
      var a = answers[q.id];
      return a === undefined || a === null || q.options[a].score < 2;
    }).slice(0, 2);
    weak.forEach(function(q) {
      var a = answers[q.id];
      var currentScore = (a !== undefined && a !== null) ? q.options[a].score : 0;
      var nextLevel = q.options[Math.min(currentScore + 1, 3)];
      recs.push({
        section: section.title,
        question: q.question,
        target: nextLevel.label,
        nis2_reference: q.nis2_reference,
        priority: currentScore === 0 ? 'high' : 'medium',
      });
    });
  });
  recs.sort(function(a, b) {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  });
  return recs.slice(0, 6);
}

async function sendReport() {
  var email = document.getElementById('report-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('report-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  var btn = document.getElementById('send-report-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending\u2026';
  showMsg('report-msg', '', '');

  try {
    var res = await fetch('/nis2-conformity-assessment/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: assessmentId, email: email }),
    });
    var data = await res.json();
    if (!res.ok) {
      showMsg('report-msg', data.error || 'Failed to send report.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Report';
      return;
    }
    showMsg('report-msg', 'Report sent! Check your inbox.', 'success');
    document.getElementById('report-form').classList.add('hidden');
  } catch (err) {
    showMsg('report-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Send Report';
  }
}

async function subscribeLaunch() {
  var email = document.getElementById('subscribe-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('subscribe-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  var btn = document.getElementById('subscribe-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Subscribing\u2026';
  showMsg('subscribe-msg', '', '');

  try {
    var res = await fetch('/conformity-assessment/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    });
    var data = await res.json();
    if (!res.ok) {
      showMsg('subscribe-msg', data.error || 'Failed to subscribe.', 'error');
      btn.disabled = false;
      btn.textContent = 'Notify Me at Launch';
      return;
    }
    showMsg('subscribe-msg', 'You\\u2019re on the list! We\\u2019ll be in touch when CRANIS2 launches.', 'success');
    document.getElementById('subscribe-form').classList.add('hidden');
  } catch (err) {
    showMsg('subscribe-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Notify Me at Launch';
  }
}

function startOver() {
  assessmentId = null;
  answers = {};
  currentSection = 0;
  document.getElementById('phase-results').classList.add('hidden');
  document.getElementById('phase-results').innerHTML = '';
  document.getElementById('phase-email').classList.remove('hidden');
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('email-input').value = sessionEmail;
  document.getElementById('code-input').value = '';
  showMsg('email-msg', '', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMsg(containerId, text, type) {
  var el = document.getElementById(containerId);
  if (!text) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
}

function escapeHtmlJS(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
</script>
</body>
</html>`;
}

module.exports = {
  SECTIONS,
  QUESTIONS,
  ENTITY_LABELS,
  determineEntityClass,
  getEntityDetails,
  computeScores,
  getTopRecommendations,
  buildReportEmail,
  assessmentPage,
};
