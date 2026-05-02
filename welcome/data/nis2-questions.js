/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

const SECTIONS = [
  {
    id: 'applicability',
    title: 'Applicability & Classification',
    description: 'NIS2 applies to organisations in specific sectors that meet size thresholds. These questions help determine whether your organisation falls within scope and whether it would be classified as an essential or important entity. This affects the supervision regime and penalty levels.',
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

const QUESTIONS = [
  // ── Section 0: Applicability & Classification ──
  {
    id: 'sector',
    section: 0,
    question: 'Which sector does your organisation primarily operate in?',
    explanation: 'NIS2 applies to organisations in sectors listed in Annexes I (highly critical) and II (other critical). Annex I sectors include energy, transport, banking, financial market infrastructure, health, drinking water, waste water, digital infrastructure, ICT service management, public administration, and space. Annex II covers postal services, waste management, chemicals, food, manufacturing, digital providers, and research.',
    nis2_reference: 'Annexes I & II',
    options: [
      { label: 'Not listed – our sector is not in Annex I or II', score: 0 },
      { label: 'Annex II sector – other critical sector (e.g. postal, food, manufacturing, digital providers)', score: 1 },
      { label: 'Annex I sector – highly critical (e.g. energy, transport, health, digital infrastructure)', score: 2 },
      { label: 'Multiple Annex I sectors – we operate across several highly critical sectors', score: 3 },
    ],
  },
  {
    id: 'entity_size',
    section: 0,
    question: 'What is the size of your organisation?',
    explanation: 'NIS2 generally applies to medium-sized and large enterprises. Medium enterprises have 50–249 employees or €10M–€50M turnover. Large enterprises have 250+ employees or €50M+ turnover. Some entities are in scope regardless of size, including providers of DNS services, TLD name registries, cloud computing, data centres, CDNs, managed services/security services, trust services, and public electronic communications networks.',
    nis2_reference: 'Article 2; Recitals 7–9',
    options: [
      { label: 'Micro/small – fewer than 50 employees and under €10M turnover', score: 0 },
      { label: 'Medium – 50–249 employees or €10M–€50M turnover', score: 1 },
      { label: 'Large – 250+ employees or €50M+ turnover', score: 2 },
      { label: 'Size-independent – we provide DNS, TLD, cloud, data centre, CDN, managed security, or trust services', score: 3 },
    ],
  },
  {
    id: 'cross_border',
    section: 0,
    question: 'Does your organisation provide services or operate infrastructure across EU member states?',
    explanation: 'Entities operating across borders may be subject to NIS2 requirements in multiple jurisdictions. Article 26 provides for jurisdiction based on the main establishment, but entities providing cross-border services may need to engage with multiple national authorities. DNS service providers, TLD registries, cloud providers, and others fall under the jurisdiction where their main establishment is located.',
    nis2_reference: 'Articles 26–27',
    options: [
      { label: 'Single country – we only operate in one EU member state', score: 0 },
      { label: 'Limited cross-border – services in 2–3 member states', score: 1 },
      { label: 'Significant cross-border – services across multiple member states', score: 2 },
      { label: 'Pan-European – critical services or infrastructure spanning most/all EU member states', score: 3 },
    ],
  },

  // ── Section 1: Governance & Accountability ──
  {
    id: 'board_oversight',
    section: 1,
    question: 'Does your management body actively oversee cybersecurity risk management?',
    explanation: 'Article 20(1) requires management bodies to approve cybersecurity risk-management measures and to oversee their implementation. This is not a delegable responsibility. The board or equivalent body must be directly involved. Non-compliance can lead to temporary prohibitions on exercising managerial functions (Article 32(5)(b)).',
    nis2_reference: 'Article 20(1); Article 32(5)',
    options: [
      { label: 'Not started – cybersecurity is handled by IT without board involvement', score: 0 },
      { label: 'Aware – the board receives occasional updates but does not formally approve measures', score: 1 },
      { label: 'Partial – the board reviews cybersecurity periodically but hasn\'t formally approved risk measures', score: 2 },
      { label: 'Implemented – the board formally approves risk-management measures and reviews them regularly', score: 3 },
    ],
  },
  {
    id: 'mgmt_training',
    section: 1,
    question: 'Do members of your management body receive cybersecurity training?',
    explanation: 'Article 20(2) requires members of management bodies to follow training to gain sufficient knowledge and skills to identify risks and assess cybersecurity risk-management practices. NIS2 also encourages entities to offer similar training to their employees on a regular basis. This training must be ongoing, not a one-off exercise.',
    nis2_reference: 'Article 20(2)',
    options: [
      { label: 'Not started – no cybersecurity training for management', score: 0 },
      { label: 'Aware – management knows training is needed but none has been delivered', score: 1 },
      { label: 'Partial – some managers have received training but it\'s not systematic or regular', score: 2 },
      { label: 'Implemented – all management body members complete regular cybersecurity training with documented records', score: 3 },
    ],
  },
  {
    id: 'cyber_policies',
    section: 1,
    question: 'Do you have formal cybersecurity policies approved by management?',
    explanation: 'Article 21(2)(a) requires entities to have policies on risk analysis and information system security. These policies must be formally approved by the management body (Article 20) and should cover the full scope of NIS2 requirements, from incident handling and business continuity to supply chain security and vulnerability management. They must be reviewed and updated regularly.',
    nis2_reference: 'Article 21(2)(a); Article 20',
    options: [
      { label: 'Not started – no formal cybersecurity policies exist', score: 0 },
      { label: 'Aware – informal guidelines exist but nothing formally documented or approved', score: 1 },
      { label: 'Partial – some policies exist but they don\'t cover all NIS2 areas or aren\'t management-approved', score: 2 },
      { label: 'Implemented – comprehensive, management-approved policies covering all Article 21 areas, regularly reviewed', score: 3 },
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
      { label: 'Not started – no formal risk assessment process', score: 0 },
      { label: 'Aware – we understand risks informally but have no documented process', score: 1 },
      { label: 'Partial – we conduct risk assessments but not regularly or comprehensively', score: 2 },
      { label: 'Implemented – regular, documented risk assessments covering all network and information systems, reviewed annually', score: 3 },
    ],
  },
  {
    id: 'incident_handling',
    section: 2,
    question: 'Do you have established incident handling procedures?',
    explanation: 'Article 21(2)(b) specifically requires "incident handling" as one of the minimum cybersecurity risk-management measures. This means having defined processes for detecting, analysing, containing, responding to, and recovering from cybersecurity incidents. The procedures should define roles, escalation paths, communication protocols, and post-incident review processes.',
    nis2_reference: 'Article 21(2)(b)',
    options: [
      { label: 'Not started – no defined incident handling procedures', score: 0 },
      { label: 'Aware – we respond to incidents ad hoc without a formal process', score: 1 },
      { label: 'Partial – basic incident response exists but roles, escalation, and review processes aren\'t formalised', score: 2 },
      { label: 'Implemented – comprehensive incident handling with defined roles, escalation, containment, and post-incident review', score: 3 },
    ],
  },
  {
    id: 'hr_security',
    section: 2,
    question: 'Do you address human resources security and cybersecurity awareness?',
    explanation: 'Article 21(2)(i) requires "human resources security, access control policies and asset management." This includes security screening for critical roles, security awareness training for all staff, clear acceptable use policies, and procedures for joiners, movers, and leavers. People are often the weakest link. NIS2 recognises this explicitly.',
    nis2_reference: 'Article 21(2)(i); Article 20(2)',
    options: [
      { label: 'Not started – no cybersecurity awareness programme or HR security measures', score: 0 },
      { label: 'Aware – basic onboarding mentions security but there\'s no ongoing programme', score: 1 },
      { label: 'Partial – awareness training exists but isn\'t regular, or HR security processes have gaps', score: 2 },
      { label: 'Implemented – regular awareness training, security screening, defined joiner/mover/leaver processes, asset management', score: 3 },
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
      { label: 'Not started – no process for rapid incident detection or notification', score: 0 },
      { label: 'Aware – we know about the 24-hour requirement but can\'t reliably meet it', score: 1 },
      { label: 'Partial – we have detection tools but the escalation-to-notification path isn\'t tested', score: 2 },
      { label: 'Implemented – 24/7 detection, defined escalation, tested notification process meeting the 24-hour deadline', score: 3 },
    ],
  },
  {
    id: 'incident_notification',
    section: 3,
    question: 'Can you submit a full incident notification within 72 hours?',
    explanation: 'Article 23(4)(b) requires an incident notification within 72 hours of becoming aware of the significant incident. This must update the early warning and provide an initial assessment of the incident, including its severity and impact, and indicators of compromise where available. This requires the ability to rapidly analyse an incident and produce a structured report.',
    nis2_reference: 'Article 23(4)(b)',
    options: [
      { label: 'Not started – no structured incident analysis or reporting capability', score: 0 },
      { label: 'Aware – we can investigate incidents but producing a report within 72 hours is uncertain', score: 1 },
      { label: 'Partial – we have incident analysis processes but haven\'t tested producing NIS2-compliant reports within 72 hours', score: 2 },
      { label: 'Implemented – tested process for incident analysis and NIS2-compliant notification within 72 hours, with templates ready', score: 3 },
    ],
  },
  {
    id: 'final_report',
    section: 3,
    question: 'Can you produce a detailed final report within one month of the incident notification?',
    explanation: 'Article 23(4)(d) requires a final report within one month containing a detailed description of the incident (severity, impact), the type of threat or root cause, applied and ongoing mitigation measures, and the cross-border impact if applicable. This requires thorough post-incident analysis, root cause investigation, and documentation of lessons learned.',
    nis2_reference: 'Article 23(4)(d)',
    options: [
      { label: 'Not started – we don\'t produce post-incident reports', score: 0 },
      { label: 'Aware – we do informal post-mortems but nothing meeting NIS2 requirements', score: 1 },
      { label: 'Partial – we produce incident reports but they don\'t cover all NIS2 required elements', score: 2 },
      { label: 'Implemented – structured post-incident process producing NIS2-compliant final reports with root cause analysis', score: 3 },
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
      { label: 'Not started – we don\'t assess suppliers\' cybersecurity', score: 0 },
      { label: 'Aware – we know supplier risk is important but have no assessment process', score: 1 },
      { label: 'Partial – we assess some critical suppliers but coverage is incomplete', score: 2 },
      { label: 'Implemented – systematic supplier risk assessment covering all direct suppliers and service providers', score: 3 },
    ],
  },
  {
    id: 'supplier_contracts',
    section: 4,
    question: 'Do your contracts with suppliers include cybersecurity requirements?',
    explanation: 'NIS2 expects entities to use contractual arrangements to manage supply chain risk. This means including cybersecurity requirements in contracts, covering areas like vulnerability disclosure, incident notification, access controls, audit rights, and compliance with relevant standards. Contracts should also address what happens when a supplier\'s cybersecurity posture changes or a breach occurs.',
    nis2_reference: 'Article 21(2)(d); Recital 85',
    options: [
      { label: 'Not started – contracts don\'t include cybersecurity clauses', score: 0 },
      { label: 'Aware – some contracts mention security but without specific NIS2-aligned requirements', score: 1 },
      { label: 'Partial – critical supplier contracts include security requirements but it\'s not standard practice', score: 2 },
      { label: 'Implemented – standard cybersecurity clauses in all supplier contracts covering incident notification, audit rights, and compliance', score: 3 },
    ],
  },
  {
    id: 'supplier_monitoring',
    section: 4,
    question: 'Do you monitor the ongoing cybersecurity practices of your supply chain?',
    explanation: 'Supply chain security is not a one-time assessment. Entities must continuously monitor suppliers\' security posture, respond to newly discovered vulnerabilities in supplier products, and react to security incidents at suppliers that could affect their own services. This includes tracking supplier CVE disclosures, security advisories, and conducting periodic reviews.',
    nis2_reference: 'Article 21(2)(d); Article 21(3)',
    options: [
      { label: 'Not started – no ongoing monitoring of supplier cybersecurity', score: 0 },
      { label: 'Aware – we react to major supplier incidents but don\'t proactively monitor', score: 1 },
      { label: 'Partial – we track major suppliers\' security advisories but lack systematic monitoring', score: 2 },
      { label: 'Implemented – continuous monitoring of supplier security posture with alerting and periodic reviews', score: 3 },
    ],
  },

  // ── Section 5: Business Continuity ──
  {
    id: 'backup_management',
    section: 5,
    question: 'Do you have comprehensive backup management procedures?',
    explanation: 'Article 21(2)(c) specifically lists "backup management" as a required measure. Backups must be regular, tested, stored securely (including off-site or isolated), and able to support restoration within acceptable timeframes. The rise of ransomware makes backup integrity and isolation particularly critical. Backups that are accessible from compromised systems provide no protection.',
    nis2_reference: 'Article 21(2)(c)',
    options: [
      { label: 'Not started – ad hoc or no structured backup procedures', score: 0 },
      { label: 'Aware – backups exist but aren\'t tested regularly or stored securely', score: 1 },
      { label: 'Partial – regular backups with some testing, but no isolated/immutable copies', score: 2 },
      { label: 'Implemented – regular, tested backups with isolated/immutable copies and documented restoration procedures', score: 3 },
    ],
  },
  {
    id: 'disaster_recovery',
    section: 5,
    question: 'Do you have a tested disaster recovery plan?',
    explanation: 'Article 21(2)(c) requires "disaster recovery" capabilities alongside backup management and business continuity. A disaster recovery plan defines how you restore critical systems and services after a major incident. It must include recovery time objectives (RTOs), recovery point objectives (RPOs), priority ordering for system restoration, and must be tested regularly through exercises.',
    nis2_reference: 'Article 21(2)(c)',
    options: [
      { label: 'Not started – no formal disaster recovery plan', score: 0 },
      { label: 'Aware – we have informal ideas about recovery but nothing documented or tested', score: 1 },
      { label: 'Partial – documented DR plan exists but hasn\'t been tested recently', score: 2 },
      { label: 'Implemented – documented DR plan with defined RTOs/RPOs, tested at least annually through tabletop or full exercises', score: 3 },
    ],
  },
  {
    id: 'crisis_management',
    section: 5,
    question: 'Do you have crisis management procedures for cybersecurity events?',
    explanation: 'Article 21(2)(c) includes "crisis management" alongside business continuity. Crisis management goes beyond technical recovery. It covers decision-making under pressure, internal and external communications, coordination with authorities, customer notification, and managing reputational impact. Having a crisis management team, communication templates, and regular exercises is essential.',
    nis2_reference: 'Article 21(2)(c); Article 23',
    options: [
      { label: 'Not started – no crisis management procedures for cybersecurity events', score: 0 },
      { label: 'Aware – we\'d improvise in a crisis but have no formal procedures', score: 1 },
      { label: 'Partial – basic crisis procedures exist but no defined team, communication plan, or exercises', score: 2 },
      { label: 'Implemented – crisis management team, communication plan, authority contact details, and regular exercises', score: 3 },
    ],
  },

  // ── Section 6: Technical Security Measures ──
  {
    id: 'encryption',
    section: 6,
    question: 'Do you use encryption and cryptography to protect data?',
    explanation: 'Article 21(2)(h) requires "policies and procedures regarding the use of cryptography and, where appropriate, encryption." This means having a documented approach to when and how encryption is used, covering data at rest, data in transit, key management, and cryptographic algorithm selection. The policy should reflect the sensitivity of the data being protected and current best practices.',
    nis2_reference: 'Article 21(2)(h)',
    options: [
      { label: 'Not started – limited or no encryption in use', score: 0 },
      { label: 'Aware – TLS for web traffic but no comprehensive encryption strategy', score: 1 },
      { label: 'Partial – encryption in transit and some at rest, but no formal cryptography policy', score: 2 },
      { label: 'Implemented – documented cryptography policy, encryption at rest and in transit, key management procedures', score: 3 },
    ],
  },
  {
    id: 'mfa_access',
    section: 6,
    question: 'Do you implement multi-factor authentication and secure access controls?',
    explanation: 'Article 21(2)(j) requires "the use of multi-factor authentication or continuous authentication solutions, secured voice, video and text communications and secured emergency communication systems." MFA should be mandatory for administrative access, remote access, and access to sensitive systems. This is one of the most effective measures against credential-based attacks.',
    nis2_reference: 'Article 21(2)(j)',
    options: [
      { label: 'Not started – passwords only, no MFA', score: 0 },
      { label: 'Aware – MFA available but not enforced for all critical access', score: 1 },
      { label: 'Partial – MFA enforced for some systems (e.g. email) but not all critical/admin access', score: 2 },
      { label: 'Implemented – MFA mandatory for all administrative and remote access, with conditional access policies', score: 3 },
    ],
  },
  {
    id: 'vuln_handling',
    section: 6,
    question: 'Do you have a process for vulnerability handling and disclosure?',
    explanation: 'Article 21(2)(e) requires "vulnerability handling and disclosure." This means having processes to discover, assess, prioritise, and remediate vulnerabilities in your systems, and to disclose vulnerabilities in a coordinated manner. This includes both scanning your own infrastructure and monitoring for advisories affecting software and hardware you use.',
    nis2_reference: 'Article 21(2)(e)',
    options: [
      { label: 'Not started – no structured vulnerability management', score: 0 },
      { label: 'Aware – occasional scanning but no regular process or prioritisation', score: 1 },
      { label: 'Partial – regular scanning with some remediation process, but no disclosure policy', score: 2 },
      { label: 'Implemented – continuous scanning, risk-based prioritisation, defined remediation SLAs, and coordinated disclosure policy', score: 3 },
    ],
  },
  {
    id: 'network_security',
    section: 6,
    question: 'Is your network architecture designed with security segmentation and monitoring?',
    explanation: 'Article 21(2)(a) references "information system security" and Article 21(2)(e) covers "basic cyber hygiene practices." Network security, including segmentation, firewalling, intrusion detection, and monitoring – is fundamental. Segmentation limits lateral movement after a breach, while monitoring provides visibility needed for incident detection and response.',
    nis2_reference: 'Article 21(2)(a)(e)',
    options: [
      { label: 'Not started – flat network, minimal security controls', score: 0 },
      { label: 'Aware – basic firewalling but no segmentation or monitoring', score: 1 },
      { label: 'Partial – some segmentation and perimeter security, but limited internal monitoring', score: 2 },
      { label: 'Implemented – segmented network, defence in depth, IDS/IPS, SIEM or log monitoring, regular reviews', score: 3 },
    ],
  },
];

const ENTITY_LABELS = {
  not_in_scope: 'Likely Not in Scope',
  important: 'Important Entity',
  essential: 'Essential Entity',
  essential_critical: 'Essential Entity (Highly Critical)',
};

module.exports = { SECTIONS, QUESTIONS, ENTITY_LABELS };
