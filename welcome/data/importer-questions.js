/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Importer Obligations Assessment — Question Bank
 *
 * Based on CRA Article 18: Obligations of importers.
 * 10 questions across 3 sections matching the 10 Article 18 sub-obligations.
 */

const SECTIONS = [
  {
    id: 'verification',
    title: 'Manufacturer Verification',
    description: 'Before placing a product on the EU market, importers must verify that the manufacturer has fulfilled its CRA obligations. This includes confirming the conformity assessment, CE marking, and accompanying documentation (Art. 18(1)–(3)).',
  },
  {
    id: 'supply_chain',
    title: 'Supply Chain & Traceability',
    description: 'Importers must ensure full traceability of products with digital elements. This means identifying themselves on the product, maintaining manufacturer contact details, and ensuring proper storage and transport conditions (Art. 18(4)–(6)).',
  },
  {
    id: 'ongoing',
    title: 'Ongoing Obligations',
    description: 'After placing the product on the market, importers have continuing obligations: reporting vulnerabilities to ENISA, retaining documentation for 10 years, cooperating with market surveillance authorities, and verifying technical documentation accessibility (Art. 18(7)–(10)).',
  },
];

const QUESTIONS = [
  // Section 0: Manufacturer Verification
  {
    id: 'conformity_assessment', section: 0,
    question: 'Have you verified that the manufacturer has carried out the appropriate conformity assessment?',
    explanation: 'Article 18(1) requires importers to place on the market only products whose manufacturer has carried out the conformity assessment procedure set out in Article 32. The assessment route depends on the product category (default, important, critical).',
    cra_reference: 'Art. 18(1)',
    options: [
      { label: 'No — we have not checked the manufacturer\'s conformity assessment', score: 0, level: 'gap' },
      { label: 'Partially — we have asked but not seen documentation', score: 1, level: 'partial' },
      { label: 'Yes — we have the EU Declaration of Conformity on file', score: 2, level: 'good' },
      { label: 'Yes — we have the full conformity assessment documentation including technical file reference', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'ce_marking', section: 0,
    question: 'Does the product bear the CE marking and is it accompanied by the required documentation?',
    explanation: 'Article 18(2) requires importers to verify that the product bears the CE marking, is accompanied by the EU Declaration of Conformity and required documentation, and that the manufacturer has fulfilled its obligations under Articles 13(15), 13(16), and 13(19).',
    cra_reference: 'Art. 18(2)',
    options: [
      { label: 'No — we have not checked for CE marking or documentation', score: 0, level: 'gap' },
      { label: 'CE marking is present but we have not verified documentation', score: 1, level: 'partial' },
      { label: 'CE marking and EU Declaration of Conformity are both verified', score: 2, level: 'good' },
      { label: 'CE marking, DoC, user instructions, and support period information all verified', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'non_conformity_check', section: 0,
    question: 'Do you have a process to stop placement if you believe a product does not conform?',
    explanation: 'Article 18(5) requires that where an importer considers or has reason to consider that a product is not in conformity with essential requirements, the importer shall not place the product on the market until it has been brought into conformity.',
    cra_reference: 'Art. 18(5)',
    options: [
      { label: 'No — we do not have a non-conformity assessment process', score: 0, level: 'gap' },
      { label: 'Informal — we would react if issues were flagged', score: 1, level: 'partial' },
      { label: 'Defined — we have a documented process for non-conformity assessment', score: 2, level: 'good' },
      { label: 'Mature — documented process with market surveillance authority notification procedures', score: 3, level: 'excellent' },
    ],
  },

  // Section 1: Supply Chain & Traceability
  {
    id: 'manufacturer_contacts', section: 1,
    question: 'Do you maintain manufacturer contact details for all imported products?',
    explanation: 'Article 18(3) requires importers to keep the manufacturer\'s name, registered trade name or trademark, and contact address. This is needed so market surveillance authorities can reach the manufacturer if required.',
    cra_reference: 'Art. 18(3)',
    options: [
      { label: 'No — we do not systematically record manufacturer contact details', score: 0, level: 'gap' },
      { label: 'Partially — we have company name but not full contact information', score: 1, level: 'partial' },
      { label: 'Yes — name, trade name, and postal address on file', score: 2, level: 'good' },
      { label: 'Yes — full contact details including email, stored per-product with version tracking', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'storage_transport', section: 1,
    question: 'Do you ensure that storage or transport conditions do not jeopardise product compliance?',
    explanation: 'Article 18(4) requires importers to ensure that, while a product is under their responsibility, storage or transport conditions do not jeopardise its conformity with the essential cybersecurity requirements.',
    cra_reference: 'Art. 18(4)',
    options: [
      { label: 'No — we have not assessed this', score: 0, level: 'gap' },
      { label: 'Partially — we use standard logistics but have not mapped CRA-specific risks', score: 1, level: 'partial' },
      { label: 'Yes — documented handling procedures that address integrity and tampering risks', score: 2, level: 'good' },
      { label: 'Yes — chain-of-custody procedures with integrity verification at each handover point', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'importer_identification', section: 1,
    question: 'Is your name and contact information indicated on the product or its packaging?',
    explanation: 'Article 18(6) requires importers to indicate their name, registered trade name or trademark, and postal address on the product or its packaging, or in a document accompanying the product.',
    cra_reference: 'Art. 18(6)',
    options: [
      { label: 'No — our details are not on the product', score: 0, level: 'gap' },
      { label: 'Partially — company name is present but without full contact details', score: 1, level: 'partial' },
      { label: 'Yes — name, trade name, and postal address on packaging or documentation', score: 2, level: 'good' },
      { label: 'Yes — full details on product/packaging plus email address for security contact', score: 3, level: 'excellent' },
    ],
  },

  // Section 2: Ongoing Obligations
  {
    id: 'vulnerability_reporting', section: 2,
    question: 'Can you report actively exploited vulnerabilities to ENISA within the required timeframes?',
    explanation: 'Article 18(7) requires importers who consider that a product presents a significant cybersecurity risk to inform the manufacturer. If the manufacturer does not act, the importer must inform the relevant market surveillance authority. The importer must also be able to report vulnerabilities to ENISA.',
    cra_reference: 'Art. 18(7)',
    options: [
      { label: 'No — we have no vulnerability reporting process', score: 0, level: 'gap' },
      { label: 'Informal — we would contact the manufacturer but have no ENISA reporting capability', score: 1, level: 'partial' },
      { label: 'Defined — documented process for manufacturer notification and ENISA reporting', score: 2, level: 'good' },
      { label: 'Mature — automated monitoring, defined escalation paths, tested ENISA reporting workflow', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'documentation_retention', section: 2,
    question: 'Do you retain copies of the EU Declaration of Conformity and technical documentation for 10 years?',
    explanation: 'Article 18(8) requires importers to keep a copy of the EU Declaration of Conformity at the disposal of market surveillance authorities for 10 years after the product has been placed on the market, and ensure the technical documentation can be made available upon request.',
    cra_reference: 'Art. 18(8)',
    options: [
      { label: 'No — we do not systematically retain compliance documentation', score: 0, level: 'gap' },
      { label: 'Partially — we keep some records but without a 10-year retention policy', score: 1, level: 'partial' },
      { label: 'Yes — 10-year retention policy with DoC copies stored securely', score: 2, level: 'good' },
      { label: 'Yes — 10-year retention with timestamped archives, version tracking, and audit trail', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'authority_cooperation', section: 2,
    question: 'Are you prepared to cooperate with market surveillance authorities upon request?',
    explanation: 'Article 18(9) requires importers, upon a reasoned request from a market surveillance authority, to provide all the information and documentation necessary to demonstrate the conformity of the product, in a language easily understood by that authority.',
    cra_reference: 'Art. 18(9)',
    options: [
      { label: 'No — we are not prepared for authority requests', score: 0, level: 'gap' },
      { label: 'Partially — we could respond but it would take significant effort to compile documentation', score: 1, level: 'partial' },
      { label: 'Yes — documentation is organised and accessible for authority requests', score: 2, level: 'good' },
      { label: 'Yes — designated contact person, pre-compiled compliance dossier, multi-language capability', score: 3, level: 'excellent' },
    ],
  },
  {
    id: 'tech_doc_access', section: 2,
    question: 'Can you ensure that technical documentation remains accessible throughout the support period?',
    explanation: 'Article 18(10) requires importers to ensure that the technical documentation drawn up in accordance with Article 31 can be made available to market surveillance authorities throughout the expected product lifetime or the support period, whichever is longer.',
    cra_reference: 'Art. 18(10)',
    options: [
      { label: 'No — we have not addressed long-term documentation accessibility', score: 0, level: 'gap' },
      { label: 'Partially — documentation exists but accessibility beyond initial placement is uncertain', score: 1, level: 'partial' },
      { label: 'Yes — documentation stored with defined access procedures for the support period', score: 2, level: 'good' },
      { label: 'Yes — documentation in a compliance vault with guaranteed retention and accessibility', score: 3, level: 'excellent' },
    ],
  },
];

module.exports = { SECTIONS, QUESTIONS };
